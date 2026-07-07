import type { AIProvider, ProviderOptions } from './types'
import { postJson } from './http'

// Talks to the Gemini REST API directly (generativelanguage.googleapis.com), replacing
// the ~16 MB @google/genai SDK. The key goes in the x-goog-api-key header rather than the
// URL query string so it never leaks into logs.
export function createGeminiProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is required')

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`

  return {
    async complete(prompt: string): Promise<string> {
      const data = await postJson(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: opts.maxTokens },
        },
        { 'x-goog-api-key': apiKey },
        opts.timeout,
      ) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

      // Concatenate every text part of the first candidate — mirrors the SDK's
      // `response.text`, which joins multi-part responses into one string.
      const parts = data.candidates?.[0]?.content?.parts ?? []
      return parts.map(p => p.text ?? '').join('')
    },
  }
}
