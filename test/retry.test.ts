import { describe, it, expect, vi, afterEach } from 'vitest'
import { withResilience } from '../src/providers/retry'
import { EXIT } from '../src/errors'

function httpError(status: number, headers?: Record<string, string>) {
  const e = new Error(`status ${status}`) as Error & { status: number; headers?: unknown }
  e.status = status
  if (headers) e.headers = headers
  return e
}

afterEach(() => {
  vi.useRealTimers()
})

describe('withResilience', () => {
  it('retries retryable failures (5xx) and eventually succeeds', async () => {
    vi.useFakeTimers()
    let calls = 0
    const provider = {
      complete: vi.fn(async () => {
        calls++
        if (calls < 3) throw httpError(500)
        return 'ok'
      }),
    }

    const promise = withResilience(provider, { timeout: 5000, maxRetries: 3 }).complete('x')
    await vi.runAllTimersAsync()

    await expect(promise).resolves.toBe('ok')
    expect(provider.complete).toHaveBeenCalledTimes(3)
  })

  it('does not retry a non-retryable auth error and maps it to a USAGE CliError', async () => {
    const provider = { complete: vi.fn(async () => { throw httpError(401) }) }

    await expect(
      withResilience(provider, { timeout: 1000, maxRetries: 3 }).complete('x')
    ).rejects.toMatchObject({ code: EXIT.USAGE })
    expect(provider.complete).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries on persistent 429 and throws a RUNTIME CliError', async () => {
    vi.useFakeTimers()
    const provider = { complete: vi.fn(async () => { throw httpError(429) }) }

    const promise = withResilience(provider, { timeout: 5000, maxRetries: 2 }).complete('x')
    const expectation = expect(promise).rejects.toMatchObject({ code: EXIT.RUNTIME })
    await vi.runAllTimersAsync()
    await expectation

    expect(provider.complete).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('honours a numeric Retry-After header before the next attempt', async () => {
    vi.useFakeTimers()
    let calls = 0
    const provider = {
      complete: vi.fn(async () => {
        calls++
        if (calls === 1) throw httpError(429, { 'retry-after': '20' })
        return 'ok'
      }),
    }

    const promise = withResilience(provider, { timeout: 5000, maxRetries: 2 }).complete('x')
    // Backoff alone would be ~0.5s; the 20s Retry-After must dominate. Advancing 19s is
    // not enough to release the retry...
    await vi.advanceTimersByTimeAsync(19_000)
    expect(provider.complete).toHaveBeenCalledTimes(1)
    // ...advancing past 20s is.
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(promise).resolves.toBe('ok')
    expect(provider.complete).toHaveBeenCalledTimes(2)
  })

  it('caps an absurd Retry-After at the max', async () => {
    vi.useFakeTimers()
    let calls = 0
    const provider = {
      complete: vi.fn(async () => {
        calls++
        if (calls === 1) throw httpError(429, { 'Retry-After': '99999' })
        return 'ok'
      }),
    }

    const promise = withResilience(provider, { timeout: 5000, maxRetries: 1 }).complete('x')
    // Capped at 30s — advancing 31s releases it even though the header asked for ~27h.
    await vi.advanceTimersByTimeAsync(31_000)
    await expect(promise).resolves.toBe('ok')
    expect(provider.complete).toHaveBeenCalledTimes(2)
  })

  it('treats an empty response as retryable then fails', async () => {
    vi.useFakeTimers()
    const provider = { complete: vi.fn(async () => '   ') }

    const promise = withResilience(provider, { timeout: 5000, maxRetries: 1 }).complete('x')
    const expectation = expect(promise).rejects.toMatchObject({ code: EXIT.RUNTIME })
    await vi.runAllTimersAsync()
    await expectation

    expect(provider.complete).toHaveBeenCalledTimes(2)
  })
})
