import type { AIProvider, ProviderOptions } from './types'
import { createOpenAIChatProvider } from './http'

export function createOpenAIProvider(opts: ProviderOptions): AIProvider {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required')

  return createOpenAIChatProvider(opts, {
    baseURL: 'https://api.openai.com/v1',
    apiKey,
    // `max_completion_tokens` (not the deprecated `max_tokens`) — reasoning models
    // (o-series, gpt-5) reject `max_tokens` with a 400, and it's the canonical param
    // for every current chat model on the OpenAI API.
    maxTokensField: 'max_completion_tokens',
  })
}
