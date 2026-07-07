import type { AIProvider, ProviderOptions } from './types'

// Shared HTTP layer for the fetch-based providers. Ledger only ever needs a single
// non-streaming completion per run, so every provider is one POST — no vendor SDK
// required. Dropping those SDKs is what takes the install from ~58 MB to ~3 MB.

// Error thrown on a non-2xx response. Carries `status` and `headers` so the resilience
// layer (retry.ts) can honour 401/403/429/5xx handling and a provider's Retry-After hint.
export interface HttpError extends Error {
  status: number
  headers: Headers
}

// POST a pre-serialized body and parse a JSON response. Aborts on timeout so the socket
// isn't leaked while the resilience layer's race-based timeout gives up in parallel.
// Takes the body as a string (not an object) so callers that must sign the exact bytes —
// SigV4 for Bedrock IAM — send precisely what they signed.
export async function postRaw(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeout: number,
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(timeout),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`) as HttpError
    err.status = res.status
    err.headers = res.headers
    throw err
  }

  return res.json()
}

// POST a JSON body (serialized here) with the JSON content type.
export function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeout: number,
): Promise<unknown> {
  return postRaw(url, JSON.stringify(body), { 'Content-Type': 'application/json', ...headers }, timeout)
}

// Strip a trailing slash so a configured baseURL like `https://x/v1/` doesn't produce
// a double slash when we append the path.
export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

// ---- OpenAI-compatible Chat Completions core --------------------------------------
// Shared by every provider that speaks the OpenAI `/chat/completions` shape: the
// first-party `openai` provider, `openrouter`, `ollama`, and the generic
// `openai-compatible` provider. One implementation, four thin wrappers.

export interface OpenAIChatConfig {
  baseURL: string
  apiKey: string
  headers?: Record<string, string>
  // Reasoning models on the OpenAI API reject `max_tokens` and require
  // `max_completion_tokens`; other OpenAI-compatible servers only understand
  // `max_tokens`. Each wrapper picks the field its endpoint expects.
  maxTokensField?: 'max_tokens' | 'max_completion_tokens'
}

export function createOpenAIChatProvider(opts: ProviderOptions, cfg: OpenAIChatConfig): AIProvider {
  const url = `${trimTrailingSlash(cfg.baseURL)}/chat/completions`
  const field = cfg.maxTokensField ?? 'max_tokens'

  return {
    async complete(prompt: string): Promise<string> {
      const data = await postJson(
        url,
        {
          model: opts.model,
          messages: [{ role: 'user', content: prompt }],
          [field]: opts.maxTokens,
        },
        { Authorization: `Bearer ${cfg.apiKey}`, ...cfg.headers },
        opts.timeout,
      ) as { choices?: Array<{ message?: { content?: string } }> }

      return data.choices?.[0]?.message?.content ?? ''
    },
  }
}
