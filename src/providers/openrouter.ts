import type { AIProvider, ProviderOptions } from './types'
import { createOpenAIChatProvider } from './http'

export function createOpenRouterProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is required')

  return createOpenAIChatProvider(opts, {
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    headers: {
      'HTTP-Referer': 'https://github.com/anishhs-gh/ledger',
      'X-Title': 'Ledger',
    },
  })
}
