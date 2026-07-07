import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenAIProvider } from '../src/providers/openai'

const OPTS = { model: 'gpt-4o', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

function mockFetch(message: Record<string, unknown> | undefined) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ choices: [{ message: message ?? {} }] }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

function bodyOf(fn: ReturnType<typeof mockFetch>) {
  return JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
}
function headersOf(fn: ReturnType<typeof mockFetch>) {
  return (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
}

beforeEach(() => { process.env.OPENAI_API_KEY = 'sk-test' })
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('openai provider', () => {
  it('throws when OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY
    expect(() => createOpenAIProvider(OPTS)).toThrow(/OPENAI_API_KEY/)
  })

  it('POSTs to the OpenAI endpoint with the bearer key', async () => {
    const fn = mockFetch({ content: 'hi' })
    await createOpenAIProvider(OPTS).complete('prompt')
    expect(fn.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
    expect(headersOf(fn).Authorization).toBe('Bearer sk-test')
  })

  it('sends max_completion_tokens (not the deprecated max_tokens)', async () => {
    const fn = mockFetch({ content: 'hi' })
    await createOpenAIProvider(OPTS).complete('prompt')
    const body = bodyOf(fn)
    expect(body.max_completion_tokens).toBe(256)
    expect(body).not.toHaveProperty('max_tokens')
    expect(body.model).toBe('gpt-4o')
    expect(body.messages).toEqual([{ role: 'user', content: 'prompt' }])
  })

  it('returns the message content', async () => {
    mockFetch({ content: 'the answer' })
    expect(await createOpenAIProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when content is absent', async () => {
    mockFetch({})
    expect(await createOpenAIProvider(OPTS).complete('x')).toBe('')
  })
})
