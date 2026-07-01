import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createMock, ctorArgs } = vi.hoisted(() => ({
  createMock: vi.fn(),
  ctorArgs: [] as unknown[],
}))

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } }
    constructor(args: unknown) { ctorArgs.push(args) }
  },
}))

import { createOpenAIProvider } from '../src/providers/openai'

const OPTS = { model: 'gpt-4o', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  createMock.mockReset()
  ctorArgs.length = 0
  process.env.OPENAI_API_KEY = 'sk-test'
})
afterEach(() => { process.env = { ...savedEnv } })

describe('openai provider', () => {
  it('throws when OPENAI_API_KEY is missing', () => {
    delete process.env.OPENAI_API_KEY
    expect(() => createOpenAIProvider(OPTS)).toThrow(/OPENAI_API_KEY/)
  })

  it('passes the api key to the SDK', () => {
    createOpenAIProvider(OPTS)
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'sk-test', timeout: 60_000 })
  })

  it('sends max_completion_tokens (not the deprecated max_tokens)', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'hi' } }] })
    await createOpenAIProvider(OPTS).complete('prompt')
    const params = createMock.mock.calls[0][0]
    expect(params.max_completion_tokens).toBe(256)
    expect(params).not.toHaveProperty('max_tokens')
    expect(params.model).toBe('gpt-4o')
    expect(params.messages).toEqual([{ role: 'user', content: 'prompt' }])
  })

  it('returns the message content', async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: 'the answer' } }] })
    expect(await createOpenAIProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when content is absent', async () => {
    createMock.mockResolvedValue({ choices: [{ message: {} }] })
    expect(await createOpenAIProvider(OPTS).complete('x')).toBe('')
  })
})
