import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGeminiProvider } from '../src/providers/gemini'

const OPTS = { model: 'gemini-2.5-flash', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

function mockFetch(parts: Array<{ text?: string }> | undefined) {
  const candidates = parts === undefined ? [] : [{ content: { parts } }]
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ candidates }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => { process.env.GEMINI_API_KEY = 'gem-test' })
afterEach(() => { vi.unstubAllGlobals(); process.env = { ...savedEnv } })

describe('gemini provider', () => {
  it('throws when GEMINI_API_KEY is missing', () => {
    delete process.env.GEMINI_API_KEY
    expect(() => createGeminiProvider(OPTS)).toThrow(/GEMINI_API_KEY/)
  })

  it('targets the model endpoint and sends the key in the header (not the URL)', async () => {
    const fn = mockFetch([{ text: 'hi' }])
    await createGeminiProvider(OPTS).complete('prompt')
    const url = fn.mock.calls[0][0] as string
    expect(url).toContain('/v1beta/models/gemini-2.5-flash:generateContent')
    expect(url).not.toContain('gem-test')
    const headers = (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
    expect(headers['x-goog-api-key']).toBe('gem-test')
  })

  it('sends the prompt and maxOutputTokens', async () => {
    const fn = mockFetch([{ text: 'hi' }])
    await createGeminiProvider(OPTS).complete('prompt')
    const body = JSON.parse((fn.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({
      contents: [{ parts: [{ text: 'prompt' }] }],
      generationConfig: { maxOutputTokens: 256 },
    })
  })

  it('returns the response text, joining multiple parts', async () => {
    mockFetch([{ text: 'the ' }, { text: 'answer' }])
    expect(await createGeminiProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when there are no candidates', async () => {
    mockFetch(undefined)
    expect(await createGeminiProvider(OPTS).complete('x')).toBe('')
  })
})
