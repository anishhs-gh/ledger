import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, ProviderOptions } from './types'

export function createAnthropicProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

  const client = new Anthropic({ apiKey, timeout: opts.timeout, maxRetries: 0 })

  return {
    async complete(prompt: string): Promise<string> {
      const res = await client.messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = res.content[0]
      return block.type === 'text' ? block.text : ''
    },
  }
}
