import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, ProviderOptions } from './types'

export function createGeminiProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')

  const genAI = new GoogleGenerativeAI(apiKey)

  return {
    async complete(prompt: string): Promise<string> {
      const geminiModel = genAI.getGenerativeModel({
        model: opts.model,
        generationConfig: { maxOutputTokens: opts.maxTokens },
      })
      const result = await geminiModel.generateContent(prompt)
      return result.response.text()
    },
  }
}
