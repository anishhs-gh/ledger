import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createMock, ctorArgs } = vi.hoisted(() => ({
  createMock: vi.fn(),
  ctorArgs: [] as Array<Record<string, unknown>>,
}))

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } }
    constructor(args: Record<string, unknown>) { ctorArgs.push(args) }
  },
}))

import { createOllamaProvider } from '../src/providers/ollama'

const OPTS = { model: 'llama3.2', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  createMock.mockReset()
  createMock.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
  ctorArgs.length = 0
  delete process.env.OLLAMA_BASE_URL
})
afterEach(() => { process.env = { ...savedEnv } })

describe('ollama provider', () => {
  it('defaults to the local Ollama endpoint with a placeholder key', () => {
    createOllamaProvider(OPTS)
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'ollama', baseURL: 'http://localhost:11434/v1' })
  })

  it('honours OLLAMA_BASE_URL', () => {
    process.env.OLLAMA_BASE_URL = 'http://gpu-box:11434/v1'
    createOllamaProvider(OPTS)
    expect(ctorArgs[0]).toMatchObject({ baseURL: 'http://gpu-box:11434/v1' })
  })

  it('sends the request and parses the response', async () => {
    const out = await createOllamaProvider(OPTS).complete('x')
    expect(out).toBe('ok')
    expect(createMock.mock.calls[0][0]).toMatchObject({ model: 'llama3.2', max_tokens: 256 })
  })
})
