import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { ctorArgs, getModelMock, generateContentMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn()
  const getModelMock = vi.fn(() => ({ generateContent: generateContentMock }))
  return { ctorArgs: [] as string[], getModelMock, generateContentMock }
})

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getModelMock
    constructor(apiKey: string) { ctorArgs.push(apiKey) }
  },
}))

import { createGeminiProvider } from '../src/providers/gemini'

const OPTS = { model: 'gemini-2.5-flash', maxTokens: 256, timeout: 60_000, maxRetries: 0 }
const savedEnv = { ...process.env }

beforeEach(() => {
  ctorArgs.length = 0
  getModelMock.mockClear()
  generateContentMock.mockReset()
  generateContentMock.mockResolvedValue({ response: { text: () => 'the answer' } })
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
    expect(ctorArgs[0]).toBe('gem-test')
  })

  it('configures the model with maxOutputTokens', async () => {
    await createGeminiProvider(OPTS).complete('prompt')
    expect(getModelMock).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 256 },
    })
    expect(generateContentMock).toHaveBeenCalledWith('prompt')
  })

  it('returns the response text', async () => {
    expect(await createGeminiProvider(OPTS).complete('x')).toBe('the answer')
  })
})
