import type { AIProvider, ProviderOptions } from './types'
import { createOpenAIChatProvider } from './http'

export function createOllamaProvider(opts: ProviderOptions): AIProvider {
  const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1'

  // Ollama exposes an OpenAI-compatible endpoint; a key is unused but a placeholder
  // keeps the Authorization header well-formed.
  return createOpenAIChatProvider(opts, { baseURL, apiKey: 'ollama' })
}
