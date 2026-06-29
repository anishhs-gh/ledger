import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadConfig } from '../src/config/loader'
import { EXIT } from '../src/errors'

let cfgFile: string
const savedEnv = { ...process.env }

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-cfg-'))
  cfgFile = path.join(dir, 'ledger.config.yaml')
  delete process.env.LEDGER_PROVIDER
  delete process.env.LEDGER_MODEL
  delete process.env.LEDGER_BASE_URL
})

afterEach(() => {
  process.env = { ...savedEnv }
})

describe('loadConfig precedence', () => {
  it('reads provider/model from the config file', () => {
    fs.writeFileSync(cfgFile, 'provider: anthropic\nmodel: claude-x\n')
    const cfg = loadConfig({ configPath: cfgFile })
    expect(cfg.provider).toBe('anthropic')
    expect(cfg.model).toBe('claude-x')
  })

  it('applies the default model when none is set', () => {
    fs.writeFileSync(cfgFile, 'provider: openai\n')
    expect(loadConfig({ configPath: cfgFile }).model).toBe('gpt-4o')
  })

  it('CLI override beats the config file', () => {
    fs.writeFileSync(cfgFile, 'provider: openai\n')
    expect(loadConfig({ configPath: cfgFile, provider: 'gemini' }).provider).toBe('gemini')
  })

  it('env var beats the CLI override', () => {
    fs.writeFileSync(cfgFile, 'provider: openai\n')
    process.env.LEDGER_PROVIDER = 'ollama'
    expect(loadConfig({ configPath: cfgFile, provider: 'gemini' }).provider).toBe('ollama')
  })

  it('passes through maxTokens / timeout overrides', () => {
    fs.writeFileSync(cfgFile, 'provider: openai\n')
    const cfg = loadConfig({ configPath: cfgFile, maxTokens: 1000, timeout: 5000 })
    expect(cfg.maxTokens).toBe(1000)
    expect(cfg.timeout).toBe(5000)
  })

  it('throws a USAGE CliError for an unknown provider', () => {
    fs.writeFileSync(cfgFile, 'provider: bogus\n')
    expect(() => loadConfig({ configPath: cfgFile })).toThrowError(
      expect.objectContaining({ code: EXIT.USAGE })
    )
  })

  it('throws a USAGE CliError when no provider is configured', () => {
    fs.writeFileSync(cfgFile, 'model: x\n')
    expect(() => loadConfig({ configPath: cfgFile })).toThrowError(
      expect.objectContaining({ code: EXIT.USAGE })
    )
  })
})

describe('openai-compatible provider', () => {
  it('accepts a baseURL + model from the config file', () => {
    fs.writeFileSync(
      cfgFile,
      'provider: openai-compatible\nbaseURL: https://api.groq.com/openai/v1\nmodel: llama-3.3-70b\n'
    )
    const cfg = loadConfig({ configPath: cfgFile })
    expect(cfg.provider).toBe('openai-compatible')
    expect(cfg.baseURL).toBe('https://api.groq.com/openai/v1')
    expect(cfg.model).toBe('llama-3.3-70b')
  })

  it('requires a baseURL', () => {
    fs.writeFileSync(cfgFile, 'provider: openai-compatible\nmodel: x\n')
    expect(() => loadConfig({ configPath: cfgFile })).toThrowError(
      expect.objectContaining({ code: EXIT.USAGE })
    )
  })

  it('requires a model (no per-provider default)', () => {
    fs.writeFileSync(cfgFile, 'provider: openai-compatible\nbaseURL: http://localhost:1234/v1\n')
    expect(() => loadConfig({ configPath: cfgFile })).toThrowError(
      expect.objectContaining({ code: EXIT.USAGE })
    )
  })

  it('takes baseURL from the --base-url override / LEDGER_BASE_URL', () => {
    fs.writeFileSync(cfgFile, 'provider: openai-compatible\nmodel: x\n')
    const cfg = loadConfig({ configPath: cfgFile, baseURL: 'http://localhost:8000/v1' })
    expect(cfg.baseURL).toBe('http://localhost:8000/v1')
  })
})
