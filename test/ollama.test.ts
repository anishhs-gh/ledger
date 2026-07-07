import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOllamaProvider } from '../src/providers/ollama'

const OPTS = { model: 'llama3.2', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
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

beforeEach(() => { delete process.env.OLLAMA_BASE_URL })
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('ollama provider', () => {
  it('defaults to the local Ollama endpoint', async () => {
    const fn = mockFetch()
    await createOllamaProvider(OPTS).complete('x')
    expect(fn.mock.calls[0][0]).toBe('http://localhost:11434/v1/chat/completions')
  })

  it('honours OLLAMA_BASE_URL', async () => {
    process.env.OLLAMA_BASE_URL = 'http://gpu-box:11434/v1'
    const fn = mockFetch()
    await createOllamaProvider(OPTS).complete('x')
    expect(fn.mock.calls[0][0]).toBe('http://gpu-box:11434/v1/chat/completions')
  })

  it('sends the request and parses the response', async () => {
    const fn = mockFetch()
    expect(await createOllamaProvider(OPTS).complete('x')).toBe('ok')
    const body = JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ model: 'llama3.2', max_tokens: 256 })
  })
})
