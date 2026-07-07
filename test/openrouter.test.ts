import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenRouterProvider } from '../src/providers/openrouter'

const OPTS = { model: 'openai/gpt-4o', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

function mockFetch() {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => { process.env.OPENROUTER_API_KEY = 'sk-or-test' })
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('openrouter provider', () => {
  it('throws when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY
    expect(() => createOpenRouterProvider(OPTS)).toThrow(/OPENROUTER_API_KEY/)
  })

  it('targets the OpenRouter endpoint with the key and attribution headers', async () => {
    const fn = mockFetch()
    await createOpenRouterProvider(OPTS).complete('x')
    expect(fn.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions')
    const headers = (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
    expect(headers.Authorization).toBe('Bearer sk-or-test')
    expect(headers['X-Title']).toBe('Ledger')
  })

  it('sends the request with max_tokens and parses the response', async () => {
    const fn = mockFetch()
    expect(await createOpenRouterProvider(OPTS).complete('x')).toBe('ok')
    const body = JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ model: 'openai/gpt-4o', max_tokens: 256 })
  })
})
