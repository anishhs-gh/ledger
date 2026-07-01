import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createMock, ctorArgs } = vi.hoisted(() => ({
  createMock: vi.fn(),
  ctorArgs: [] as unknown[],
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
    constructor(args: unknown) { ctorArgs.push(args) }
  },
}))

import { createAnthropicProvider } from '../src/providers/anthropic'

const OPTS = { model: 'claude-haiku-4-5', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  createMock.mockReset()
  ctorArgs.length = 0
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
})
afterEach(() => { process.env = { ...savedEnv } })

describe('anthropic provider', () => {
  it('throws when ANTHROPIC_API_KEY is missing', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => createAnthropicProvider(OPTS)).toThrow(/ANTHROPIC_API_KEY/)
  })

  it('sends model, max_tokens and the prompt', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'hi' }] })
    await createAnthropicProvider(OPTS).complete('prompt')
    const params = createMock.mock.calls[0][0]
    expect(params).toMatchObject({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'prompt' }],
    })
  })

  it('returns the text block', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'the answer' }] })
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('skips a leading non-text block and returns the text block', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'tool_use', id: 't1', name: 'x', input: {} },
        { type: 'text', text: 'the answer' },
      ],
    })
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when there is no text block', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }] })
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('')
  })
})
