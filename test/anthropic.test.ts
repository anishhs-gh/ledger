import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnthropicProvider } from '../src/providers/anthropic'

const OPTS = { model: 'claude-haiku-4-5', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

function mockFetch(content: unknown) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ content }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-ant-test' })
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('anthropic provider', () => {
  it('throws when ANTHROPIC_API_KEY is missing', () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(() => createAnthropicProvider(OPTS)).toThrow(/ANTHROPIC_API_KEY/)
  })

  it('POSTs to the Messages API with the key and version headers', async () => {
    const fn = mockFetch([{ type: 'text', text: 'hi' }])
    await createAnthropicProvider(OPTS).complete('prompt')
    expect(fn.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
    const headers = (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBe('2023-06-01')
  })

  it('sends model, max_tokens and the prompt', async () => {
    const fn = mockFetch([{ type: 'text', text: 'hi' }])
    await createAnthropicProvider(OPTS).complete('prompt')
    const body = JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'prompt' }],
    })
  })

  it('returns the text block', async () => {
    mockFetch([{ type: 'text', text: 'the answer' }])
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('skips a leading non-text block and returns the text block', async () => {
    mockFetch([
      { type: 'tool_use', id: 't1', name: 'x', input: {} },
      { type: 'text', text: 'the answer' },
    ])
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when there is no text block', async () => {
    mockFetch([{ type: 'tool_use', id: 't1', name: 'x', input: {} }])
    expect(await createAnthropicProvider(OPTS).complete('x')).toBe('')
  })
})
