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
        // `max_completion_tokens` (not the deprecated `max_tokens`) — reasoning models
        // (o-series, gpt-5) reject `max_tokens` with a 400, and it's the canonical param
        // for every current chat model on the OpenAI API.
        max_completion_tokens: opts.maxTokens,
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
