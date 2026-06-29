import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { writeStepSummary } from '../src/ci/summary'
import { formatOutput } from '../src/output/formatter'
import type { CiContext } from '../src/ci/detect'
import type { ReleaseNotes } from '../src/types'

let summaryFile: string

beforeEach(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-sum-'))
  summaryFile = path.join(dir, 'summary.md')
})

const baseCtx: CiContext = { isCI: true, runner: 'github' }

describe('writeStepSummary', () => {
  it('appends content and returns true when a summary file is present', () => {
    const ctx = { ...baseCtx, stepSummaryFile: summaryFile }
    expect(writeStepSummary(ctx, '# Notes\nbody', true)).toBe(true)
    expect(fs.readFileSync(summaryFile, 'utf-8')).toBe('# Notes\nbody\n')
  })

  it('appends (not overwrites) on a second call', () => {
    const ctx = { ...baseCtx, stepSummaryFile: summaryFile }
    writeStepSummary(ctx, 'one', true)
    writeStepSummary(ctx, 'two', true)
    expect(fs.readFileSync(summaryFile, 'utf-8')).toBe('one\ntwo\n')
  })

  it('does nothing when disabled', () => {
    const ctx = { ...baseCtx, stepSummaryFile: summaryFile }
    expect(writeStepSummary(ctx, 'x', false)).toBe(false)
    expect(fs.existsSync(summaryFile)).toBe(false)
  })

  it('does nothing when there is no summary file', () => {
    expect(writeStepSummary(baseCtx, 'x', true)).toBe(false)
  })
})

describe('formatOutput metadata enrichment', () => {
  const notes: ReleaseNotes = {
    title: 'Release Notes', date: '2026-06-27', range: 'v1...v2',
    audience: 'engineering', commits: 2, filesChanged: 3, content: 'body',
    repo: 'acme/widgets', ref: 'v2', runUrl: 'https://ci/run/1',
  }

  it('renders repo / ref / pipeline lines in markdown when present', () => {
    const md = formatOutput(notes, 'markdown')
    expect(md).toContain('**Repository:** acme/widgets')
    expect(md).toContain('**Ref:** v2')
    expect(md).toContain('**Pipeline:** https://ci/run/1')
  })

  it('omits metadata lines when absent', () => {
    const md = formatOutput({ ...notes, repo: undefined, ref: undefined, runUrl: undefined }, 'markdown')
    expect(md).not.toContain('**Repository:**')
    expect(md).not.toContain('**Pipeline:**')
  })

  it('includes metadata in JSON output', () => {
    const parsed = JSON.parse(formatOutput(notes, 'json'))
    expect(parsed.repo).toBe('acme/widgets')
    expect(parsed.runUrl).toBe('https://ci/run/1')
  })
})
