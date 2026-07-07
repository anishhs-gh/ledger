import type { AIProvider, ProviderOptions } from './types'
import { postJson } from './http'

// Pinned Messages API version. This is a dated contract, not a package version, so it
// stays stable regardless of any SDK — which is exactly why we no longer need one.
const ANTHROPIC_VERSION = '2023-06-01'

export function createAnthropicProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is required')

  return {
    async complete(prompt: string): Promise<string> {
      const data = await postJson(
        'https://api.anthropic.com/v1/messages',
        {
          model: opts.model,
          max_tokens: opts.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        opts.timeout,
      ) as { content?: Array<{ type?: string; text?: string }> }

      // Return the first text block rather than assuming it's at index 0 — a non-text
      // block (tool use, or a thinking block if thinking is ever enabled) can come first.
      for (const block of data.content ?? []) {
        if (block.type === 'text' && typeof block.text === 'string') return block.text
      }
      return ''
    },
  }
}
