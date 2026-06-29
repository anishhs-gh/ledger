import OpenAI from 'openai'
import type { AIProvider, ProviderOptions } from './types'

export function createOpenRouterProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is required')

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: opts.timeout,
    maxRetries: 0,
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/anishhs-gh/ledger',
      'X-Title': 'Ledger',
    },
  })

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
