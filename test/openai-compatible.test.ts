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

import { createOpenAICompatibleProvider } from '../src/providers/openai-compatible'

const base = { model: 'mixtral', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  createMock.mockReset()
  createMock.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
  ctorArgs.length = 0
  delete process.env.LEDGER_API_KEY
  delete process.env.GROQ_API_KEY
})
afterEach(() => { process.env = { ...savedEnv } })

describe('openai-compatible provider', () => {
  it('throws without a baseURL', () => {
    expect(() => createOpenAICompatibleProvider(base)).toThrow(/baseURL/)
  })

  it('reads the key from LEDGER_API_KEY by default', () => {
    process.env.LEDGER_API_KEY = 'key-default'
    createOpenAICompatibleProvider({ ...base, baseURL: 'https://api.groq.com/openai/v1' })
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'key-default', baseURL: 'https://api.groq.com/openai/v1' })
  })

  it('reads the key from a custom apiKeyEnv', () => {
    process.env.GROQ_API_KEY = 'key-custom'
    createOpenAICompatibleProvider({ ...base, baseURL: 'https://x/v1', apiKeyEnv: 'GROQ_API_KEY' })
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'key-custom' })
  })

  it('falls back to a placeholder key when none is set (keyless self-hosted servers)', () => {
    createOpenAICompatibleProvider({ ...base, baseURL: 'http://localhost:8000/v1' })
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'not-needed' })
  })

  it('forwards custom headers and parses the response', async () => {
    const provider = createOpenAICompatibleProvider({ ...base, baseURL: 'https://x/v1', headers: { 'X-A': '1' } })
    expect(ctorArgs[0]).toMatchObject({ defaultHeaders: { 'X-A': '1' } })
    expect(await provider.complete('x')).toBe('ok')
    expect(createMock.mock.calls[0][0]).toMatchObject({ model: 'mixtral', max_tokens: 256 })
  })
})
