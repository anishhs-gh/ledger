import { describe, it, expect, vi, afterEach } from 'vitest'
import { withResilience } from '../src/providers/retry'
import { EXIT } from '../src/errors'

function httpError(status: number) {
  const e = new Error(`status ${status}`) as Error & { status: number }
  e.status = status
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
