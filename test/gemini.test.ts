import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { ctorArgs, generateContentMock } = vi.hoisted(() => ({
  ctorArgs: [] as Array<Record<string, unknown>>,
  generateContentMock: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock }
    constructor(args: Record<string, unknown>) { ctorArgs.push(args) }
  },
}))

import { createGeminiProvider } from '../src/providers/gemini'

const OPTS = { model: 'gemini-2.5-flash', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  ctorArgs.length = 0
  generateContentMock.mockReset()
  generateContentMock.mockResolvedValue({ text: 'the answer' })
  process.env.GEMINI_API_KEY = 'gem-test'
})
afterEach(() => { process.env = { ...savedEnv } })

describe('gemini provider', () => {
  it('throws when GEMINI_API_KEY is missing', () => {
    delete process.env.GEMINI_API_KEY
    expect(() => createGeminiProvider(OPTS)).toThrow(/GEMINI_API_KEY/)
  })

  it('passes the api key to the SDK', () => {
    createGeminiProvider(OPTS)
    expect(ctorArgs[0]).toMatchObject({ apiKey: 'gem-test' })
  })

  it('sends model, prompt and maxOutputTokens', async () => {
    await createGeminiProvider(OPTS).complete('prompt')
    expect(generateContentMock).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: 'prompt',
      config: { maxOutputTokens: 256 },
    })
  })

  it('returns the response text', async () => {
    expect(await createGeminiProvider(OPTS).complete('x')).toBe('the answer')
  })

  it('returns empty string when text is absent', async () => {
    generateContentMock.mockResolvedValue({})
    expect(await createGeminiProvider(OPTS).complete('x')).toBe('')
  })
})
