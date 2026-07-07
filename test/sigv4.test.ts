import { describe, it, expect } from 'vitest'
import { signingKey, signRequestV4 } from '../src/providers/sigv4'

// AWS-published test vectors — if the algorithm is correct these must match exactly.
const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY'

describe('sigv4 signing key', () => {
  // From AWS docs "Examples of how to derive a signing key for Signature Version 4".
  it('matches the documented signing-key derivation', () => {
    const key = signingKey(AWS_SECRET, '20150830', 'us-east-1', 'iam')
    expect(key.toString('hex')).toBe(
      'c4afb1cc5771d871763a393e44b703571b55cc28424d1a5e86da6ed3c154a4b9'
    )
  })
})

describe('sigv4 request signing', () => {
  // AWS SigV4 test-suite case "get-vanilla": a full end-to-end signature over a GET with
  // an empty body, signing only host and x-amz-date.
  it('matches the get-vanilla test-suite signature', () => {
    const headers = signRequestV4({
      method: 'GET',
      host: 'example.amazonaws.com',
      path: '/',
      region: 'us-east-1',
      service: 'service',
      body: '',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: AWS_SECRET,
      now: new Date('2015-08-30T12:36:00Z'),
    })

    expect(headers['x-amz-date']).toBe('20150830T123600Z')
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
      'SignedHeaders=host;x-amz-date, ' +
      'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
    )
  })

  it('adds content-type and the session token to the signed headers when present', () => {
    const headers = signRequestV4({
      method: 'POST',
      host: 'bedrock-runtime.us-east-1.amazonaws.com',
      path: '/model/x/converse',
      region: 'us-east-1',
      service: 'bedrock',
      body: '{}',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: AWS_SECRET,
      sessionToken: 'SESSION',
      contentType: 'application/json',
      now: new Date('2015-08-30T12:36:00Z'),
    })

    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-amz-security-token']).toBe('SESSION')
    expect(headers.authorization).toContain(
      'SignedHeaders=content-type;host;x-amz-date;x-amz-security-token'
    )
  })
})
