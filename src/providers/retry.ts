import { CliError, EXIT } from '../errors'
import type { AIProvider } from './types'

export interface ResilienceOptions {
  timeout: number
  maxRetries: number
}

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8000

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

// Wraps a provider with a per-request timeout and exponential-backoff retry.
// This is the single place resilience is applied, so every provider benefits.
export function withResilience(provider: AIProvider, opts: ResilienceOptions): AIProvider {
  return {
    async complete(prompt: string): Promise<string> {
      let lastErr: unknown

      for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
          const result = await withTimeout(provider.complete(prompt), opts.timeout)
          if (!result.trim()) {
            throw new EmptyResponseError()
          }
          return result
        } catch (err) {
          lastErr = err
          if (!isRetryable(err) || attempt === opts.maxRetries) break
          await sleep(backoffDelay(attempt))
        }
      }

      throw normalizeError(lastErr, opts.maxRetries)
    },
  }
}

class EmptyResponseError extends Error {
  constructor() {
    super('Provider returned an empty response')
    this.name = 'EmptyResponseError'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

function isRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError || err instanceof EmptyResponseError) return true

  const status = httpStatus(err)
  if (status === 429) return true
  if (status !== undefined && status >= 500) return true

  // Network-level failures (no HTTP response received).
  const code = (err as { code?: string })?.code
  if (code && ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE'].includes(code)) {
    return true
  }
  const message = (err as Error)?.message ?? ''
  return /fetch failed|network|socket hang up/i.test(message)
}

function httpStatus(err: unknown): number | undefined {
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode
  return typeof status === 'number' ? status : undefined
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  const jitter = Math.random() * exp * 0.25
  return Math.round(exp + jitter)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Turn low-level provider errors into a friendly CliError with the right exit code.
function normalizeError(err: unknown, maxRetries: number): CliError {
  const status = httpStatus(err)

  if (status === 401 || status === 403) {
    return new CliError(
      'Authentication failed — check that your API key is set and valid.',
      EXIT.USAGE
    )
  }
  if (status === 429) {
    return new CliError(
      `Rate limited by the provider after ${maxRetries + 1} attempt(s). Try again later or lower request frequency.`,
      EXIT.RUNTIME
    )
  }
  if (err instanceof TimeoutError) {
    return new CliError(
      `${err.message} after ${maxRetries + 1} attempt(s). Increase --timeout or check connectivity.`,
      EXIT.RUNTIME
    )
  }
  if (err instanceof EmptyResponseError) {
    return new CliError(err.message, EXIT.RUNTIME)
  }

  const message = (err as Error)?.message ?? String(err)
  return new CliError(`AI provider request failed: ${message}`, EXIT.RUNTIME)
}
