export type Audience = 'engineering' | 'business' | 'qa'
export type OutputFormat = 'markdown' | 'json'
export type WriteMode = 'overwrite' | 'append' | 'prepend'
export type ProviderName =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'ollama'
  | 'bedrock'
  | 'openai-compatible'

export interface LedgerConfig {
  provider: ProviderName
  model: string
  maxDiffLines?: number
  maxTokens?: number
  timeout?: number
  maxRetries?: number
  // For provider `openai-compatible`: the OpenAI-compatible API base URL
  // (e.g. https://api.groq.com/openai/v1). Also settable via LEDGER_BASE_URL or --base-url.
  baseURL?: string
  // Name of the env var holding the API key for `openai-compatible` (default: LEDGER_API_KEY).
  apiKeyEnv?: string
  // Optional extra HTTP headers for `openai-compatible` requests.
  headers?: Record<string, string>
}

export interface Commit {
  sha: string
  shortSha: string
  author: string
  email: string
  date: string
  message: string
}

export interface FileDiff {
  path: string
  operation: 'added' | 'modified' | 'deleted' | 'renamed'
  newPath?: string
  linesAdded: number
  linesRemoved: number
  diff: string
  truncated: boolean
}

export interface ChangeAnalysis {
  from: string
  to: string
  commits: Commit[]
  files: FileDiff[]
  totalLinesAdded: number
  totalLinesRemoved: number
}

export interface ReleaseNotes {
  title: string
  date: string
  range: string
  audience: Audience
  commits: number
  filesChanged: number
  content: string
  repo?: string
  ref?: string
  runUrl?: string
}
