import OpenAI from 'openai'
import type { AIProvider, ProviderOptions } from './types'

export function createOllamaProvider(opts: ProviderOptions): AIProvider {
  const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'

  // Ollama exposes an OpenAI-compatible endpoint; apiKey is required by the SDK but unused
  const client = new OpenAI({ apiKey: 'ollama', baseURL, timeout: opts.timeout, maxRetries: 0 })

  return {
    async complete(prompt: string): Promise<string> {
      const res = await client.chat.completions.create({
        model: opts.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens,
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
