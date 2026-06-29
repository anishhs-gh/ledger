import { describe, it, expect } from 'vitest'
import { reduceContext } from '../src/context/reducer'
import type { ChangeAnalysis, FileDiff } from '../src/types'

function file(p: string, diff: string): FileDiff {
  return { path: p, operation: 'modified', linesAdded: 1, linesRemoved: 0, diff, truncated: false }
}

function analysis(files: FileDiff[]): ChangeAnalysis {
  return {
    from: 'v1', to: 'v2',
    commits: [{ sha: 'a'.repeat(40), shortSha: 'aaaaaaa', author: 'A', email: 'a@b.c', date: '2026-01-01', message: 'do thing' }],
    files,
    totalLinesAdded: files.length,
    totalLinesRemoved: 0,
  }
}

describe('reduceContext', () => {
  it('includes the summary, commits and file list', () => {
    const out = reduceContext(analysis([file('a.ts', 'diff --git a/a.ts b/a.ts\n+x')]))
    expect(out).toContain('## Summary')
    expect(out).toContain('Range: v1 → v2')
    expect(out).toContain('do thing')
    expect(out).toContain('a.ts')
  })

  it('truncates a per-file diff that exceeds the cap', () => {
    const big = 'diff --git a/big.ts b/big.ts\n' + '+line\n'.repeat(2000)
    const out = reduceContext(analysis([file('big.ts', big)]))
    expect(out).toContain('(truncated)')
  })

  it('omits files once the total context cap is reached', () => {
    const files = Array.from({ length: 40 }, (_, i) =>
      file(`f${i}.ts`, 'diff --git a/x b/x\n' + 'a'.repeat(2900))
    )
    const out = reduceContext(analysis(files))
    expect(out).toMatch(/additional file\(s\) omitted/)
  })
})
