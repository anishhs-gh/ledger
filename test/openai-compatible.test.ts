import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenAICompatibleProvider } from '../src/providers/openai-compatible'

const base = { model: 'mixtral', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
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
function headersOf(fn: ReturnType<typeof mockFetch>) {
  return (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
}

beforeEach(() => {
  delete process.env.LEDGER_API_KEY
  delete process.env.GROQ_API_KEY
})
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('openai-compatible provider', () => {
  it('throws without a baseURL', () => {
    expect(() => createOpenAICompatibleProvider(base)).toThrow(/baseURL/)
  })

  it('reads the key from LEDGER_API_KEY by default and targets the baseURL', async () => {
    process.env.LEDGER_API_KEY = 'key-default'
    const fn = mockFetch()
    await createOpenAICompatibleProvider({ ...base, baseURL: 'https://api.groq.com/openai/v1' }).complete('x')
    expect(fn.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(headersOf(fn).Authorization).toBe('Bearer key-default')
  })

  it('reads the key from a custom apiKeyEnv', async () => {
    process.env.GROQ_API_KEY = 'key-custom'
    const fn = mockFetch()
    await createOpenAICompatibleProvider({ ...base, baseURL: 'https://x/v1', apiKeyEnv: 'GROQ_API_KEY' }).complete('x')
    expect(headersOf(fn).Authorization).toBe('Bearer key-custom')
  })

  it('falls back to a placeholder key when none is set (keyless self-hosted servers)', async () => {
    const fn = mockFetch()
    await createOpenAICompatibleProvider({ ...base, baseURL: 'http://localhost:8000/v1' }).complete('x')
    expect(headersOf(fn).Authorization).toBe('Bearer not-needed')
  })

  it('forwards custom headers and parses the response', async () => {
    const fn = mockFetch()
    const provider = createOpenAICompatibleProvider({ ...base, baseURL: 'https://x/v1', headers: { 'X-A': '1' } })
    expect(await provider.complete('x')).toBe('ok')
    expect(headersOf(fn)['X-A']).toBe('1')
    const body = JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ model: 'mixtral', max_tokens: 256 })
  })
})
