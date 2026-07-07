import { Command } from 'commander'
import fs from 'fs'
import path from 'path'

const TEMPLATE = `# Ledger — AI-powered release notes

# Provider: openai | anthropic | gemini | openrouter | ollama | bedrock | openai-compatible
provider: openai

# Model to use (defaults are set per provider if omitted)
model: gpt-4o

# Using any other OpenAI-compatible service (Groq, Together, Fireworks, DeepSeek,
# Azure OpenAI, a local vLLM/LiteLLM server, ...)? Set provider to openai-compatible
# and point baseURL at its endpoint. Key is read from LEDGER_API_KEY by default.
# provider: openai-compatible
# baseURL: https://api.groq.com/openai/v1
# model: llama-3.3-70b-versatile
# apiKeyEnv: GROQ_API_KEY   # optional: read the key from a different env var
# headers:                  # optional: extra request headers
#   X-Title: my-app

# Optional: default audience when --audience is not passed (engineering | business | qa)
# audience: engineering

# Optional: max diff lines per file sent to the AI (reduces token usage on large PRs)
# maxDiffLines: 100

# Optional: max tokens for the AI response (default 4096). This output budget is also counted
# against some providers' per-minute token limits, so lower it on tight free tiers; raise it if
# a large diff produces truncated notes (models that reason, e.g. Claude Sonnet 5, share it).
# maxTokens: 4096

# Optional: per-request timeout in milliseconds (default 60000)
# timeout: 60000

# Optional: retry attempts on transient provider errors (default 3)
# maxRetries: 3
`

export const initCommand = new Command('init')
  .description('Create ledger.config.yaml in the current directory')
  .action(() => {
    const dest = path.join(process.cwd(), 'ledger.config.yaml')

    if (fs.existsSync(dest)) {
      process.stderr.write(`Config already exists: ${dest}\n`)
      process.exit(1)
    }

    fs.writeFileSync(dest, TEMPLATE, 'utf-8')

    process.stdout.write(`Created ledger.config.yaml\n\n`)
    process.stdout.write(`Next steps:\n`)
    process.stdout.write(`  1. Set your API key, e.g.:  export OPENAI_API_KEY=sk-...\n`)
    process.stdout.write(`  2. Run:  ledger generate --since-last-tag\n`)
  })
