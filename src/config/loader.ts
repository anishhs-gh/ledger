import fs from 'fs'
import path from 'path'
import * as yaml from 'js-yaml'
import { CliError, EXIT } from '../errors'
import type { LedgerConfig, ProviderName } from '../types'

const CONFIG_FILES = [
  'ledger.config.yaml',
  'ledger.config.yml',
  '.ledger.yaml',
  '.ledger.yml',
  'ledger.config.json',
]

const VALID_PROVIDERS: ProviderName[] = [
  'openai', 'anthropic', 'gemini', 'openrouter', 'ollama', 'bedrock', 'openai-compatible',
]

// No default model for `openai-compatible` — it depends entirely on the endpoint, so the
// user must name one.
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-pro',
  openrouter: 'openai/gpt-4o',
  ollama: 'llama3.1',
  bedrock: 'anthropic.claude-sonnet-5',
  'openai-compatible': '',
}

export interface ConfigOverrides {
  configPath?: string
  provider?: string
  model?: string
  maxTokens?: number
  timeout?: number
  baseURL?: string
}

export function loadConfig(overrides: ConfigOverrides = {}): LedgerConfig {
  let raw: Partial<LedgerConfig> = {}

  if (overrides.configPath) {
    raw = readConfigFile(path.resolve(overrides.configPath))
  } else {
    const found = CONFIG_FILES.find(f => fs.existsSync(path.join(process.cwd(), f)))
    if (found) {
      raw = readConfigFile(path.join(process.cwd(), found))
    }
  }

  // CLI flags override file config
  if (overrides.provider) raw.provider = overrides.provider as ProviderName
  if (overrides.model) raw.model = overrides.model
  if (overrides.maxTokens !== undefined) raw.maxTokens = overrides.maxTokens
  if (overrides.timeout !== undefined) raw.timeout = overrides.timeout
  if (overrides.baseURL !== undefined) raw.baseURL = overrides.baseURL

  // Env vars override everything
  if (process.env.LEDGER_PROVIDER) raw.provider = process.env.LEDGER_PROVIDER as ProviderName
  if (process.env.LEDGER_MODEL) raw.model = process.env.LEDGER_MODEL
  if (process.env.LEDGER_BASE_URL) raw.baseURL = process.env.LEDGER_BASE_URL

  if (!raw.provider) {
    throw new CliError(
      'No provider configured. Create a ledger.config.yaml or run `ledger init`.',
      EXIT.USAGE
    )
  }

  if (!VALID_PROVIDERS.includes(raw.provider)) {
    throw new CliError(
      `Unknown provider "${raw.provider}". Valid options: ${VALID_PROVIDERS.join(', ')}`,
      EXIT.USAGE
    )
  }

  if (raw.provider === 'openai-compatible') {
    if (!raw.baseURL) {
      throw new CliError(
        'The openai-compatible provider requires a baseURL (set `baseURL` in config, ' +
          'LEDGER_BASE_URL, or --base-url), e.g. https://api.groq.com/openai/v1',
        EXIT.USAGE
      )
    }
    if (!raw.model) {
      throw new CliError(
        'The openai-compatible provider requires a model (set `model` in config or --model).',
        EXIT.USAGE
      )
    }
  } else if (!raw.model) {
    raw.model = DEFAULT_MODELS[raw.provider]
  }

  return raw as LedgerConfig
}

function readConfigFile(filePath: string): Partial<LedgerConfig> {
  if (!fs.existsSync(filePath)) {
    throw new CliError(`Config file not found: ${filePath}`, EXIT.USAGE)
  }

  const content = fs.readFileSync(filePath, 'utf-8')

  try {
    if (filePath.endsWith('.json')) {
      return JSON.parse(content)
    }
    return (yaml.load(content) as Partial<LedgerConfig>) ?? {}
  } catch (err) {
    throw new CliError(`Failed to parse config ${filePath}: ${(err as Error).message}`, EXIT.USAGE)
  }
}
