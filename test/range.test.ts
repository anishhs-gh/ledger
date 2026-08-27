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
    // describe(HEAD) -> v9.9.9, and v9.9.9 is NOT the same commit as HEAD, so it is used as-is.
    const git = fakeGit(args => {
      if (args[0] === 'describe') return 'v9.9.9\n'
      if (args[0] === 'rev-parse') return args[1].startsWith('v9.9.9') ? 'tagsha\n' : 'headsha\n'
      return reject()
    })
    expect(await resolveRange(git, {})).toEqual({ from: 'v9.9.9', to: 'HEAD' })
  })

  // --- first release -------------------------------------------------------
  // Each of these produced an empty range (or a hard error) before, so the notes
  // came out blank and callers fell through to their own fallback.

  it('anchors to the empty tree when the repo has no tags at all', async () => {
    const r = await resolveRange(fakeGit(reject), { sinceLastTag: true })
    expect(r).toEqual({ from: EMPTY_TREE, to: 'HEAD' })
  })

  it('anchors to the empty tree when the only tag is the one just cut on HEAD', async () => {
    // You tagged v1.0.0 and then ran ledger: describe(HEAD) -> v1.0.0, which is HEAD itself.
    // There is no tag before it, so the range must cover the whole history.
    const git = fakeGit(args => {
      if (args[0] === 'describe') return args[3] === 'HEAD' ? 'v1.0.0\n' : reject() // v1.0.0^ has no tag
      if (args[0] === 'rev-parse') return 'samesha\n' // tag and HEAD are the same commit
      return reject()
    })
    expect(await resolveRange(git, { sinceLastTag: true })).toEqual({ from: EMPTY_TREE, to: 'HEAD' })
  })

  it('steps back to the previous tag when HEAD is already tagged', async () => {
    // Second release: describe(HEAD) -> v2.0.0 (== HEAD), so use the tag before it.
    const git = fakeGit(args => {
      if (args[0] === 'describe') return args[3] === 'HEAD' ? 'v2.0.0\n' : 'v1.0.0\n'
      if (args[0] === 'rev-parse') return 'samesha\n'
      return reject()
    })
    expect(await resolveRange(git, { sinceLastTag: true })).toEqual({ from: 'v1.0.0', to: 'HEAD' })
  })
})

describe('resolveCiRange', () => {
  const ctx = (over: Partial<CiContext>): CiContext => ({ isCI: true, runner: 'github', ...over })

  it('tag build → previous tag .. tag', async () => {
    const git = fakeGit(args => (args[0] === 'describe' ? 'v1.0.0\n' : reject()))
    expect(await resolveCiRange(git, ctx({ tag: 'v1.1.0' }))).toEqual({ from: 'v1.0.0', to: 'v1.1.0' })
  })

  // The root commit is NOT a usable `from`: `<root>..<tag>` is half-open, so it drops the
  // root commit and the whole initial import — and is completely empty in a single-commit
  // repo. The empty tree is the only anchor that includes it.
  it('first-tag build → empty tree .. tag', async () => {
    const git = fakeGit(args => (args[0] === 'describe' ? reject() : reject()))
    expect(await resolveCiRange(git, ctx({ tag: 'v1.0.0' }))).toEqual({ from: EMPTY_TREE, to: 'v1.0.0' })
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
