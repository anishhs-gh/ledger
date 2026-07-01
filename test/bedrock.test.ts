import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }))
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class { send = sendMock },
  ConverseCommand: class { constructor(public input: unknown) {} },
}))

import { createBedrockProvider } from '../src/providers/bedrock'

const OPTS = { model: 'openai.gpt-oss-20b-1:0', maxTokens: 256, timeout: 60_000, maxRetries: 0 }

function mockFetch(content: unknown) {
  const fn = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ output: { message: { content } } }),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('bedrock provider (API key path)', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    process.env.BEDROCK_API_KEY = 'ABSK-test'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...saved }
  })

  it('returns a plain text block (non-reasoning models)', async () => {
    mockFetch([{ text: 'hello world' }])
    const provider = createBedrockProvider(OPTS)
    expect(await provider.complete('hi')).toBe('hello world')
  })

  it('skips a leading reasoningContent block and returns the answer (gpt-oss)', async () => {
    mockFetch([
      { reasoningContent: { reasoningText: { text: 'let me think...' } } },
      { text: 'the answer' },
    ])
    const provider = createBedrockProvider(OPTS)
    expect(await provider.complete('hi')).toBe('the answer')
  })

  it('returns empty string when no text block is present', async () => {
    mockFetch([{ reasoningContent: { reasoningText: { text: 'only reasoning' } } }])
    const provider = createBedrockProvider(OPTS)
    expect(await provider.complete('hi')).toBe('')
  })

  it('falls back to us-east-1 when AWS_REGION is empty (not just unset)', async () => {
    process.env.AWS_REGION = ''
    const fn = mockFetch([{ text: 'ok' }])
    const provider = createBedrockProvider(OPTS)
    await provider.complete('hi')
    const url = fn.mock.calls[0][0] as string
    expect(url).toContain('bedrock-runtime.us-east-1.amazonaws.com')
    expect(url).not.toContain('bedrock-runtime..amazonaws.com')
  })

  it('honours an explicit AWS_REGION', async () => {
    process.env.AWS_REGION = 'eu-west-1'
    const fn = mockFetch([{ text: 'ok' }])
    const provider = createBedrockProvider(OPTS)
    await provider.complete('hi')
    expect(fn.mock.calls[0][0] as string).toContain('bedrock-runtime.eu-west-1.amazonaws.com')
  })
})

describe('bedrock provider (IAM path)', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    sendMock.mockReset()
    delete process.env.BEDROCK_API_KEY // no key → IAM credential path
  })
  afterEach(() => { process.env = { ...saved } })

  it('returns the text block via the AWS SDK', async () => {
    sendMock.mockResolvedValue({ output: { message: { content: [{ text: 'iam answer' }] } } })
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('iam answer')
  })

  it('skips a leading reasoning block on the IAM path too', async () => {
    sendMock.mockResolvedValue({
      output: { message: { content: [{ reasoningContent: {} }, { text: 'iam answer' }] } },
    })
    expect(await createBedrockProvider(OPTS).complete('hi')).toBe('iam answer')
  })
})
