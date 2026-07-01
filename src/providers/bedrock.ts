import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import type { AIProvider, ProviderOptions } from './types'

export function createBedrockProvider(opts: ProviderOptions): AIProvider {
  // `||` (not `??`) so an empty AWS_REGION — which is what a workflow `env:` block sets
  // when the underlying secret/variable is missing — still falls back to a real region.
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
  const apiKey = process.env.BEDROCK_API_KEY

  // Bedrock API keys (ABSK-prefixed) use x-api-key header auth — not IAM credential chain
  if (apiKey) {
    return createWithApiKey(opts, region, apiKey)
  }

  // Fallback: standard IAM credentials (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
  return createWithIAM(opts, region)
}

function createWithApiKey(opts: ProviderOptions, region: string, apiKey: string): AIProvider {
  const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(opts.model)}/converse`

  return {
    async complete(prompt: string): Promise<string> {
      const body = JSON.stringify({
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: opts.maxTokens },
      })

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
        // Abort the underlying request on timeout instead of leaking the socket while the
        // resilience layer's race-based timeout gives up.
        signal: AbortSignal.timeout(opts.timeout),
      })

      if (!res.ok) {
        const text = await res.text()
        const err = new Error(`Bedrock API error ${res.status}: ${text}`) as Error & { status: number }
        err.status = res.status
        throw err
      }

      const data = await res.json() as {
        output?: { message?: { content?: Array<{ text?: string }> } }
      }
      return extractText(data.output?.message?.content)
    },
  }
}

function createWithIAM(opts: ProviderOptions, region: string): AIProvider {
  const client = new BedrockRuntimeClient({ region })

  return {
    async complete(prompt: string): Promise<string> {
      const command = new ConverseCommand({
        modelId: opts.model,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: opts.maxTokens },
      })

      const res = await client.send(command)
      return extractText(res.output?.message?.content)
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
