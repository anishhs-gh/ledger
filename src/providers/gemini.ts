import { GoogleGenAI } from '@google/genai'
import type { AIProvider, ProviderOptions } from './types'

// Uses @google/genai — the unified Google GenAI SDK that replaces the now-deprecated
// @google/generative-ai package.
export function createGeminiProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')

  const ai = new GoogleGenAI({ apiKey })

  return {
    async complete(prompt: string): Promise<string> {
      const response = await ai.models.generateContent({
        model: opts.model,
        contents: prompt,
        config: { maxOutputTokens: opts.maxTokens },
      })
      return response.text ?? ''
    },
  }
}
