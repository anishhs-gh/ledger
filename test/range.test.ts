import { describe, it, expect } from 'vitest'
import { resolveRange, resolveCiRange, EMPTY_TREE } from '../src/git/collector'
import type { CiContext } from '../src/ci/detect'

// A fake SimpleGit whose `.raw` is driven by a handler over the argv.
function fakeGit(handler: (args: string[]) => string | Promise<string>) {
  return {
    raw: async (args: string[]) => {
      const out = await handler(args)
      return out
    },
  } as any
}

const reject = () => Promise.reject(new Error('unknown revision'))

describe('resolveRange', () => {
  // A fake git that reports a fixed commit count for `rev-list --count`.
  const gitWithCount = (count: number) =>
    fakeGit(args => (args[0] === 'rev-list' && args.includes('--count') ? `${count}\n` : reject()))

  it('maps --last N to <to>~N..HEAD when history is deep enough', async () => {
    const r = await resolveRange(gitWithCount(10), { last: 3 })
    expect(r).toEqual({ from: 'HEAD~3', to: 'HEAD' })
  })

  it('anchors to the empty tree when --last N meets or exceeds the commit count', async () => {
    const r = await resolveRange(gitWithCount(2), { last: 5 })
    expect(r).toEqual({ from: EMPTY_TREE, to: 'HEAD' })
  })

  it('anchors to the empty tree when --last N equals the commit count', async () => {
    const r = await resolveRange(gitWithCount(2), { last: 2 })
    expect(r).toEqual({ from: EMPTY_TREE, to: 'HEAD' })
  })

  it('falls back to the literal range when the count is unknown', async () => {
    const r = await resolveRange(fakeGit(reject), { last: 3 })
    expect(r).toEqual({ from: 'HEAD~3', to: 'HEAD' })
  })

  it('anchors --last relative to an explicit --to', async () => {
    const r = await resolveRange(gitWithCount(10), { last: 2, to: 'v2.0.0' })
    expect(r).toEqual({ from: 'v2.0.0~2', to: 'v2.0.0' })
  })

  it('uses an explicit --from', async () => {
    const r = await resolveRange(fakeGit(reject), { from: 'v1.0.0' })
    expect(r).toEqual({ from: 'v1.0.0', to: 'HEAD' })
  })

  it('falls back to the last tag by default', async () => {
    const r = await resolveRange(fakeGit(args => (args[0] === 'describe' ? 'v9.9.9\n' : reject())), {})
    expect(r).toEqual({ from: 'v9.9.9', to: 'HEAD' })
  })
})

describe('resolveCiRange', () => {
  const ctx = (over: Partial<CiContext>): CiContext => ({ isCI: true, runner: 'github', ...over })

  it('tag build → previous tag .. tag', async () => {
    const git = fakeGit(args => (args[0] === 'describe' ? 'v1.0.0\n' : reject()))
    expect(await resolveCiRange(git, ctx({ tag: 'v1.1.0' }))).toEqual({ from: 'v1.0.0', to: 'v1.1.0' })
  })

  it('first-tag build → root commit .. tag', async () => {
    const git = fakeGit(args => {
      if (args[0] === 'describe') return reject()
      if (args[0] === 'rev-list') return 'rootsha\n'
      return reject()
    })
    expect(await resolveCiRange(git, ctx({ tag: 'v1.0.0' }))).toEqual({ from: 'rootsha', to: 'v1.0.0' })
  })

  it('PR build prefers origin/<base> when it resolves', async () => {
    const git = fakeGit(args => {
      if (args[0] === 'rev-parse' && args.includes('origin/main^{commit}')) return 'sha\n'
      return reject()
    })
    expect(await resolveCiRange(git, ctx({ baseRef: 'main' }))).toEqual({ from: 'origin/main', to: 'HEAD' })
  })

  it('PR build falls back to the local base branch', async () => {
    const git = fakeGit(args => {
      if (args[0] === 'rev-parse' && args.includes('main^{commit}')) return 'sha\n'
      return reject() // origin/main^{commit} rejects
    })
    expect(await resolveCiRange(git, ctx({ baseRef: 'main' }))).toEqual({ from: 'main', to: 'HEAD' })
  })

  it('returns null when context implies no range', async () => {
    expect(await resolveCiRange(fakeGit(reject), ctx({}))).toBeNull()
  })
})
