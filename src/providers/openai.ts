import OpenAI from 'openai'
import type { AIProvider, ProviderOptions } from './types'

export function createOpenAIProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required')

  const client = new OpenAI({ apiKey, timeout: opts.timeout, maxRetries: 0 })

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
