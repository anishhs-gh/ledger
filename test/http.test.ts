import { describe, it, expect, vi, afterEach } from 'vitest'
import { postJson, postRaw, trimTrailingSlash, createOpenAIChatProvider, type HttpError } from '../src/providers/http'
import { withResilience } from '../src/providers/retry'
import { EXIT } from '../src/errors'

const OPTS = { model: 'm1', maxTokens: 128, timeout: 5000, maxRetries: 0 }

function okJson(body: unknown, headers = new Headers()) {
  return { ok: true, status: 200, headers, json: async () => body }
}
function errResponse(status: number, text: string, headers = new Headers()) {
  return { ok: false, status, headers, text: async () => text }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('postJson', () => {
  it('POSTs a JSON body with the JSON content type and merged headers, and parses the response', async () => {
    const fn = vi.fn(async () => okJson({ ok: true }))
    vi.stubGlobal('fetch', fn)

    const out = await postJson('https://x/y', { a: 1 }, { 'X-Custom': '1' }, 5000)

    expect(out).toEqual({ ok: true })
    const [url, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://x/y')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect((init.headers as Record<string, string>)['X-Custom']).toBe('1')
    expect(init.body).toBe('{"a":1}')
  })
})

describe('postRaw', () => {
  it('sends the exact body string it was given (no re-serialization)', async () => {
    const fn = vi.fn(async () => okJson({}))
    vi.stubGlobal('fetch', fn)

    const body = '{"already":"serialized"}'
    await postRaw('https://x/y', body, { Authorization: 'Bearer k' }, 5000)

    expect((fn.mock.calls[0][1] as RequestInit).body).toBe(body)
  })

  it('throws an HttpError carrying the status and a readable Headers instance on a non-2xx', async () => {
    const headers = new Headers({ 'retry-after': '12' })
    vi.stubGlobal('fetch', vi.fn(async () => errResponse(429, 'rate limited', headers)))

    let caught: HttpError | undefined
    try {
      await postRaw('https://x/y', '{}', {}, 5000)
    } catch (e) {
      caught = e as HttpError
    }

    expect(caught).toBeDefined()
    expect(caught!.status).toBe(429)
    // The resilience layer reads Retry-After off these headers — the value must be reachable.
    expect(caught!.headers.get('retry-after')).toBe('12')
    expect(caught!.message).toContain('429')
  })

  it('does not throw on a non-2xx whose body text() rejects — still surfaces the status', async () => {
    const res = { ok: false, status: 500, headers: new Headers(), text: async () => { throw new Error('boom') } }
    vi.stubGlobal('fetch', vi.fn(async () => res))

    await expect(postRaw('https://x/y', '{}', {}, 5000)).rejects.toMatchObject({ status: 500 })
  })
})

describe('trimTrailingSlash', () => {
  it('strips one or more trailing slashes and leaves clean URLs untouched', () => {
    expect(trimTrailingSlash('https://x/v1/')).toBe('https://x/v1')
    expect(trimTrailingSlash('https://x/v1///')).toBe('https://x/v1')
    expect(trimTrailingSlash('https://x/v1')).toBe('https://x/v1')
  })
})

describe('createOpenAIChatProvider', () => {
  it('defaults to max_tokens and appends /chat/completions without a double slash', async () => {
    const fn = vi.fn(async () => okJson({ choices: [{ message: { content: 'hi' } }] }))
    vi.stubGlobal('fetch', fn)

    await createOpenAIChatProvider(OPTS, { baseURL: 'https://x/v1/', apiKey: 'k' }).complete('p')

    expect(fn.mock.calls[0][0]).toBe('https://x/v1/chat/completions')
    const body = JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_tokens).toBe(128)
    expect(body).not.toHaveProperty('max_completion_tokens')
  })

  it('uses max_completion_tokens when the wrapper asks for it', async () => {
    const fn = vi.fn(async () => okJson({ choices: [{ message: { content: 'hi' } }] }))
    vi.stubGlobal('fetch', fn)

    await createOpenAIChatProvider(OPTS, { baseURL: 'https://x/v1', apiKey: 'k', maxTokensField: 'max_completion_tokens' }).complete('p')

    const body = JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string)
    expect(body.max_completion_tokens).toBe(128)
    expect(body).not.toHaveProperty('max_tokens')
  })

  it('returns an empty string when the choice has no content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => okJson({ choices: [{ message: {} }] })))
    expect(await createOpenAIChatProvider(OPTS, { baseURL: 'https://x/v1', apiKey: 'k' }).complete('p')).toBe('')
  })
})

// End-to-end seam: a real fetch 429 (with a Headers-instance Retry-After) must flow through
// postRaw's HttpError into the resilience layer and drive a header-honouring retry. retry.test
// only exercises plain-object headers, so this covers the Headers.get() path.
describe('http + resilience integration', () => {
  it('retries a 429 honouring the Retry-After header, then succeeds', async () => {
    vi.useFakeTimers()
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls++
      if (calls === 1) return errResponse(429, 'slow down', new Headers({ 'retry-after': '5' }))
      return okJson({ choices: [{ message: { content: 'done' } }] })
    }))

    const provider = createOpenAIChatProvider(OPTS, { baseURL: 'https://x/v1', apiKey: 'k' })
    const promise = withResilience(provider, { timeout: 5000, maxRetries: 2 }).complete('p')

    // Exponential backoff alone would fire in ~0.5s; the 5s Retry-After must dominate.
    await vi.advanceTimersByTimeAsync(4_000)
    expect(calls).toBe(1)
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(promise).resolves.toBe('done')
    expect(calls).toBe(2)
  })

  it('maps a real 401 fetch response to a USAGE auth error without retrying', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => errResponse(401, 'bad key')))

    const provider = createOpenAIChatProvider(OPTS, { baseURL: 'https://x/v1', apiKey: 'k' })
    await expect(
      withResilience(provider, { timeout: 5000, maxRetries: 3 }).complete('p')
    ).rejects.toMatchObject({ code: EXIT.USAGE })
  })
})
