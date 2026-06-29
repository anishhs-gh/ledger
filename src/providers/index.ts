import type { LedgerConfig } from '../types'
import type { AIProvider, ProviderOptions } from './types'
import { createOpenAIProvider } from './openai'
import { createAnthropicProvider } from './anthropic'
import { createGeminiProvider } from './gemini'
import { createOpenRouterProvider } from './openrouter'
import { createOllamaProvider } from './ollama'
import { createBedrockProvider } from './bedrock'
import { createOpenAICompatibleProvider } from './openai-compatible'
import { withResilience } from './retry'

export const DEFAULT_MAX_TOKENS = 4096
export const DEFAULT_TIMEOUT_MS = 60_000
export const DEFAULT_MAX_RETRIES = 3

export function createProvider(config: LedgerConfig): AIProvider {
  const opts: ProviderOptions = {
    model: config.model,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    baseURL: config.baseURL,
    apiKeyEnv: config.apiKeyEnv,
    headers: config.headers,
  }

  const provider = buildProvider(config, opts)
  return withResilience(provider, { timeout: opts.timeout, maxRetries: opts.maxRetries })
}

function buildProvider(config: LedgerConfig, opts: ProviderOptions): AIProvider {
  switch (config.provider) {
    case 'openai':     return createOpenAIProvider(opts)
    case 'anthropic':  return createAnthropicProvider(opts)
    case 'gemini':     return createGeminiProvider(opts)
    case 'openrouter': return createOpenRouterProvider(opts)
    case 'ollama':     return createOllamaProvider(opts)
    case 'bedrock':    return createBedrockProvider(opts)
    case 'openai-compatible': return createOpenAICompatibleProvider(opts)
    default:
      throw new Error(`Unknown provider: ${(config as LedgerConfig).provider}`)
  }
}
