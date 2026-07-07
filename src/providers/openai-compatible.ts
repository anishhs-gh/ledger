import type { AIProvider, ProviderOptions } from './types'
import { createOpenAIChatProvider } from './http'

// Generic provider for any service that speaks the OpenAI Chat Completions API —
// Groq, Together, Fireworks, DeepSeek, Mistral, xAI, Perplexity, Azure OpenAI, or a
// self-hosted vLLM / LiteLLM / LocalAI endpoint. The user supplies the base URL, the
// model, and (usually) an API key; this is the common ground so no provider is locked out.
export function createOpenAICompatibleProvider(opts: ProviderOptions): AIProvider {
  if (!opts.baseURL) {
    throw new Error(
      'The openai-compatible provider needs a baseURL (set `baseURL` in config, LEDGER_BASE_URL, or --base-url).'
    )
  }

  const keyEnv = opts.apiKeyEnv ?? 'LEDGER_API_KEY'
  // Some self-hosted servers need no key; fall back to a placeholder so the Authorization
  // header is well-formed. Real cloud endpoints will surface a clear 401 if the key is missing.
  const apiKey = process.env[keyEnv] ?? 'not-needed'

  return createOpenAIChatProvider(opts, {
    baseURL: opts.baseURL,
    apiKey,
    headers: opts.headers,
  })
}
