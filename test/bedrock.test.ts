import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBedrockProvider } from '../src/providers/bedrock'

const OPTS = { model: 'openai.gpt-oss-20b-1:0', maxTokens: 256, timeout: 60_000, maxRetries: 0 }

function mockFetch(content: unknown) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ output: { message: { content } } }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}
function headersOf(fn: ReturnType<typeof mockFetch>) {
  return (fn.mock.calls[0][1] as { headers: Record<string, string> }).headers
}

describe('bedrock provider (API key path)', () => {
  const saved = { ...process.env }

  beforeEach(() => { process.env.BEDROCK_API_KEY = 'ABSK-test' })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...saved }
  })

  it('returns a plain text block (non-reasoning models)', async () => {
    mockFetch([{ text: 'hello world' }])
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('hello world')
  })

  it('skips a leading reasoningContent block and returns the answer (gpt-oss)', async () => {
    mockFetch([
      { reasoningContent: { reasoningText: { text: 'let me think...' } } },
      { text: 'the answer' },
    ])
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('the answer')
  })

  it('returns empty string when no text block is present', async () => {
    mockFetch([{ reasoningContent: { reasoningText: { text: 'only reasoning' } } }])
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('')
  })

  it('sends a bearer token, not a signature', async () => {
    const fn = mockFetch([{ text: 'ok' }])
    await createBedrockProvider(OPTS).complete('hi')
    expect(headersOf(fn).Authorization).toBe('Bearer ABSK-test')
  })

  it('falls back to us-east-1 when AWS_REGION is empty (not just unset)', async () => {
    process.env.AWS_REGION = ''
    const fn = mockFetch([{ text: 'ok' }])
    await createBedrockProvider(OPTS).complete('hi')
    const url = fn.mock.calls[0][0] as string
    expect(url).toContain('bedrock-runtime.us-east-1.amazonaws.com')
    expect(url).not.toContain('bedrock-runtime..amazonaws.com')
  })

  it('honours an explicit AWS_REGION', async () => {
    process.env.AWS_REGION = 'eu-west-1'
    const fn = mockFetch([{ text: 'ok' }])
    await createBedrockProvider(OPTS).complete('hi')
    expect(fn.mock.calls[0][0] as string).toContain('bedrock-runtime.eu-west-1.amazonaws.com')
  })
})

describe('bedrock provider (IAM / SigV4 path)', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    delete process.env.BEDROCK_API_KEY // no key → IAM credential path
    delete process.env.AWS_SESSION_TOKEN
    process.env.AWS_REGION = 'us-east-1'
    process.env.AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE'
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...saved }
  })

  it('throws a clear error when IAM credentials are missing', async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    mockFetch([{ text: 'x' }])
    await expect(createBedrockProvider(OPTS).complete('hi')).rejects.toThrow(/AWS_ACCESS_KEY_ID/)
  })

  it('signs the request with SigV4 and returns the text block', async () => {
    const fn = mockFetch([{ text: 'iam answer' }])
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('iam answer')
    const headers = headersOf(fn)
    expect(headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock\/aws4_request, SignedHeaders=\S+, Signature=[0-9a-f]{64}$/
    )
    expect(headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)
    // host and content-type must be covered by the signature.
    expect(headers.authorization).toContain('content-type;host;x-amz-date')
    expect(headers).not.toHaveProperty('x-amz-security-token')
  })

  it('includes the session token when using temporary credentials (OIDC / assume-role)', async () => {
    process.env.AWS_SESSION_TOKEN = 'FwoGZXIvYXdzEXAMPLETOKEN'
    const fn = mockFetch([{ text: 'ok' }])
    await createBedrockProvider(OPTS).complete('hi')
    const headers = headersOf(fn)
    expect(headers['x-amz-security-token']).toBe('FwoGZXIvYXdzEXAMPLETOKEN')
    expect(headers.authorization).toContain('x-amz-security-token')
  })

  it('skips a leading reasoning block on the IAM path too', async () => {
    mockFetch([{ reasoningContent: {} }, { text: 'iam answer' }])
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('iam answer')
  })
})
