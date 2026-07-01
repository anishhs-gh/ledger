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

import { createOpenRouterProvider } from '../src/providers/openrouter'

const OPTS = { model: 'openai/gpt-4o', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  createMock.mockReset()
  createMock.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] })
  ctorArgs.length = 0
  process.env.OPENROUTER_API_KEY = 'sk-or-test'
})
afterEach(() => { process.env = { ...savedEnv } })

describe('openrouter provider', () => {
  it('throws when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY
    expect(() => createOpenRouterProvider(OPTS)).toThrow(/OPENROUTER_API_KEY/)
  })

  it('targets the OpenRouter base URL with the key and attribution headers', () => {
    createOpenRouterProvider(OPTS)
    expect(ctorArgs[0]).toMatchObject({
      apiKey: 'sk-or-test',
      baseURL: 'https://openrouter.ai/api/v1',
    })
    expect((ctorArgs[0].defaultHeaders as Record<string, string>)['X-Title']).toBe('Ledger')
  })

  it('sends the request and parses the response', async () => {
    expect(await createOpenRouterProvider(OPTS).complete('x')).toBe('ok')
    expect(createMock.mock.calls[0][0]).toMatchObject({ model: 'openai/gpt-4o', max_tokens: 256 })
  })
})
