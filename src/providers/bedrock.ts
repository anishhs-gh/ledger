import type { AIProvider, ProviderOptions } from './types'
import { postRaw } from './http'
import { signRequestV4 } from './sigv4'

export function createBedrockProvider(opts: ProviderOptions): AIProvider {
  // `||` (not `??`) so an empty AWS_REGION — which is what a workflow `env:` block sets
  // when the underlying secret/variable is missing — still falls back to a real region.
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
  const apiKey = process.env.BEDROCK_API_KEY

  // Bedrock API keys (ABSK-prefixed) use bearer-token auth — no signing needed.
  if (apiKey) {
    return createWithApiKey(opts, region, apiKey)
  }

  // Fallback: standard IAM credentials, signed with SigV4. Both paths are plain fetch, so
  // Bedrock works everywhere (including CI) with no SDK to install.
  return createWithIAM(opts, region)
}

function endpoint(region: string, model: string): { url: string; host: string; path: string } {
  const host = `bedrock-runtime.${region}.amazonaws.com`
  const path = `/model/${encodeURIComponent(model)}/converse`
  return { url: `https://${host}${path}`, host, path }
}

function requestBody(opts: ProviderOptions, prompt: string): string {
  return JSON.stringify({
    messages: [{ role: 'user', content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: opts.maxTokens },
  })
}

type ConverseResponse = { output?: { message?: { content?: Array<{ text?: string }> } } }

function createWithApiKey(opts: ProviderOptions, region: string, apiKey: string): AIProvider {
  const { url } = endpoint(region, opts.model)

  return {
    async complete(prompt: string): Promise<string> {
      const data = await postRaw(
        url,
        requestBody(opts, prompt),
        { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        opts.timeout,
      ) as ConverseResponse

      return extractText(data.output?.message?.content)
    },
  }
}

function createWithIAM(opts: ProviderOptions, region: string): AIProvider {
  return {
    async complete(prompt: string): Promise<string> {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
      if (!accessKeyId || !secretAccessKey) {
        throw new Error(
          'Bedrock IAM auth needs AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY ' +
          '(or set BEDROCK_API_KEY to use the keyless API-key path).'
        )
      }

      const { url, host, path } = endpoint(region, opts.model)
      const body = requestBody(opts, prompt)

      // Sign the exact body bytes we send. AWS_SESSION_TOKEN covers temporary credentials
      // from OIDC / assume-role, which is the common CI setup.
      const headers = signRequestV4({
        method: 'POST',
        host,
        path,
        region,
        service: 'bedrock',
        body,
        accessKeyId,
        secretAccessKey,
        sessionToken: process.env.AWS_SESSION_TOKEN,
        contentType: 'application/json',
      })

      const data = await postRaw(url, body, headers, opts.timeout) as ConverseResponse
      return extractText(data.output?.message?.content)
    },
  }
}

// Bedrock's Converse API returns an array of content blocks. Reasoning models
// (e.g. openai.gpt-oss, deepseek) emit a `reasoningContent` block BEFORE the answer,
// so the answer is not always at index 0 — pick the first block that actually has text.
function extractText(content: Array<{ text?: string }> | undefined): string {
  if (!content) return ''
  return content.find(block => typeof block?.text === 'string')?.text ?? ''
}
