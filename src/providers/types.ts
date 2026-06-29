export interface AIProvider {
  complete(prompt: string): Promise<string>
}

// Resolved options passed to every provider factory.
export interface ProviderOptions {
  model: string
  maxTokens: number
  timeout: number
  maxRetries: number
  // Only used by the `openai-compatible` provider.
  baseURL?: string
  apiKeyEnv?: string
  headers?: Record<string, string>
}
