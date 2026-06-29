import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import type { AIProvider, ProviderOptions } from './types'

export function createBedrockProvider(opts: ProviderOptions): AIProvider {
  // Use `||` (not `??`) so an empty-string env var (e.g. AWS_REGION="" from an unset
  // CI variable) falls back instead of producing a malformed endpoint.
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
      return data.output?.message?.content?.[0]?.text ?? ''
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
      const block = res.output?.message?.content?.[0]
      return block && 'text' in block ? block.text ?? '' : ''
    },
  }
}
