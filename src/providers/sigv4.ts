import { createHash, createHmac } from 'node:crypto'

// Minimal AWS Signature Version 4 signer — enough to sign a single Bedrock request with
// Node's built-in crypto, so we don't need the (heavy) AWS SDK just to authenticate.
// Handles temporary credentials (AWS_SESSION_TOKEN), which is what GitHub OIDC and other
// CI role-assumption flows hand you.

export interface SigV4Input {
  method: string
  host: string
  // Canonical URI: the request path, already percent-encoded exactly as it is sent.
  path: string
  region: string
  service: string
  body: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
  contentType?: string
  // Injectable clock for deterministic tests; defaults to now.
  now?: Date
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

// Derive the SigV4 signing key: HMAC chain over date → region → service → "aws4_request".
export function signingKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function amzTimestamps(d: Date): { amzDate: string; dateStamp: string } {
  // 2015-08-30T12:36:00.000Z → 20150830T123600Z
  const amzDate = d.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

// Returns the headers to attach to the request (Host is set by fetch to match the URL, so
// it is signed but not returned here).
export function signRequestV4(input: SigV4Input): Record<string, string> {
  const { amzDate, dateStamp } = amzTimestamps(input.now ?? new Date())

  const headersToSign: Record<string, string> = {
    host: input.host,
    'x-amz-date': amzDate,
  }
  if (input.contentType) headersToSign['content-type'] = input.contentType
  if (input.sessionToken) headersToSign['x-amz-security-token'] = input.sessionToken

  const sortedKeys = Object.keys(headersToSign).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headersToSign[k].trim()}\n`).join('')
  const signedHeaders = sortedKeys.join(';')

  const canonicalRequest = [
    input.method,
    input.path,
    '', // canonical query string — none
    canonicalHeaders,
    signedHeaders,
    sha256Hex(input.body),
  ].join('\n')

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const key = signingKey(input.secretAccessKey, dateStamp, input.region, input.service)
  const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('hex')

  const out: Record<string, string> = {
    'x-amz-date': amzDate,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
  if (input.contentType) out['content-type'] = input.contentType
  if (input.sessionToken) out['x-amz-security-token'] = input.sessionToken
  return out
}
