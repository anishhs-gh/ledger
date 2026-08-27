import simpleGit, { type SimpleGit } from 'simple-git'
import { CliError, EXIT } from '../errors'
import type { CiContext } from '../ci/detect'
import type { Commit } from '../types'

// Git's well-known empty-tree object. Used as the `from` side of a range to include the
// very first (root) commit — `<empty-tree>..HEAD` is accepted by both `git diff` and
// `git log`, whereas `HEAD~N` throws once N reaches past the root.
//
// It is also the correct anchor for a FIRST release. The root commit itself is not a
// usable `from`: a range is half-open, so `<root>..<tag>` excludes the root commit and
// everything it introduced — the entire initial import — and resolves to nothing at all
// in a repo whose only commit is the root. The empty tree includes it.
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export async function createGit(cwd: string = process.cwd()): Promise<SimpleGit> {
  const git = simpleGit(cwd)
  const isRepo = await git.checkIsRepo()
  if (!isRepo) {
    throw new CliError('Not a git repository. Run this command from within a git project.', EXIT.USAGE)
  }
  return git
}

export async function resolveRange(
  git: SimpleGit,
  opts: { from?: string; to?: string; sinceLastTag?: boolean; last?: number }
): Promise<{ from: string; to: string }> {
  const to = opts.to ?? 'HEAD'

  // Default behaviour when no flags given: use last tag
  if (opts.sinceLastTag || (!opts.from && opts.last === undefined)) {
    const from = await resolveSinceLastTag(git, to)
    return { from, to }
  }

  if (opts.last !== undefined) {
    // `<to>~N` doesn't exist once N reaches past the root commit (e.g. `--last 5` in a repo
    // with 2 commits), which makes git fail with a cryptic "unknown revision". When the
    // requested count meets or exceeds the available history, anchor to the empty tree so
    // the range still resolves and includes the root commit.
    const total = await countCommits(git, to)
    const from = opts.last >= total ? EMPTY_TREE : `${to}~${opts.last}`
    return { from, to }
  }

  if (opts.from) {
    return { from: opts.from, to }
  }

  throw new CliError('No range specified. Use --since-last-tag, --from <ref>, or --last <n>.', EXIT.USAGE)
}

// Derive a range from CI context when the user gave no explicit range flags.
// Returns null when the context doesn't imply one (caller falls back to since-last-tag).
export async function resolveCiRange(
  git: SimpleGit,
  ctx: CiContext
): Promise<{ from: string; to: string } | null> {
  // Tag build: previous tag .. this tag. On the FIRST release there is no previous tag,
  // so anchor to the empty tree — that covers the whole history including the root commit.
  if (ctx.tag) {
    const prevTag = await getPreviousTag(git, ctx.tag)
    return { from: prevTag ?? EMPTY_TREE, to: ctx.tag }
  }

  // PR/MR build: base branch .. HEAD. Prefer the remote-tracking ref (CI usually fetches it).
  if (ctx.baseRef) {
    const from =
      (await refExists(git, `origin/${ctx.baseRef}`)) ? `origin/${ctx.baseRef}` :
      (await refExists(git, ctx.baseRef)) ? ctx.baseRef :
      null
    if (!from) return null
    return { from, to: 'HEAD' }
  }

  return null
}

async function refExists(git: SimpleGit, ref: string): Promise<boolean> {
  try {
    // No --quiet: an unknown ref must exit non-zero so simple-git rejects.
    const out = await git.raw(['rev-parse', '--verify', `${ref}^{commit}`])
    return out.trim().length > 0
  } catch {
    return false
  }
}

// Resolve the `from` side of a since-last-tag range ending at `to`.
//
// Every branch here used to fail on a first release:
//   - no tags at all → hard error telling you to create a tag, even though "everything so
//     far" is exactly what a first release's notes should cover;
//   - `to` is itself the tag you just cut (v1.0.0 tagged, then `ledger generate`) →
//     `describe` resolves to that same tag and `v1.0.0..v1.0.0` is empty;
//   - that tag is the only one → there is no earlier tag to step back to.
// All three now anchor to the empty tree, so the notes cover the full history.
async function resolveSinceLastTag(git: SimpleGit, to: string): Promise<string> {
  const lastTag = await describeTag(git, to)
  if (!lastTag) return EMPTY_TREE

  // `describe` anchors at `to` itself, so a freshly-cut tag on `to` resolves to itself and
  // would produce an empty range. Step back to the tag before it (the real "last release").
  if (!(await isSameCommit(git, lastTag, to))) return lastTag

  return (await getPreviousTag(git, lastTag)) ?? EMPTY_TREE
}

// The most recent tag reachable from `ref`, or null when there is none.
async function describeTag(git: SimpleGit, ref: string): Promise<string | null> {
  try {
    const result = await git.raw(['describe', '--tags', '--abbrev=0', ref])
    return result.trim() || null
  } catch {
    return null
  }
}

async function isSameCommit(git: SimpleGit, a: string, b: string): Promise<boolean> {
  try {
    const [ra, rb] = await Promise.all([
      git.raw(['rev-parse', `${a}^{commit}`]),
      git.raw(['rev-parse', `${b}^{commit}`]),
    ])
    return ra.trim() === rb.trim() && ra.trim().length > 0
  } catch {
    return false
  }
}

async function getPreviousTag(git: SimpleGit, tag: string): Promise<string | null> {
  return describeTag(git, `${tag}^`)
}

// Number of commits reachable from `ref`. Returns Infinity when it can't be determined
// (e.g. unknown ref) so callers don't wrongly clamp — they fall back to the literal range.
async function countCommits(git: SimpleGit, ref: string): Promise<number> {
  try {
    const out = await git.raw(['rev-list', '--count', ref])
    const n = parseInt(out.trim(), 10)
    return Number.isFinite(n) ? n : Infinity
  } catch {
    return Infinity
  }
}

export async function collectCommits(
  git: SimpleGit,
  from: string,
  to: string
): Promise<Commit[]> {
  // symmetric:false → `from..to` (commits in `to` not in `from`), matching how the diff is
  // taken. The default `...` is a symmetric difference and also rejects the empty-tree `from`.
  const log = await git.log({ from, to, symmetric: false })
  return log.all.map(entry => ({
    sha: entry.hash,
    shortSha: entry.hash.slice(0, 7),
    author: entry.author_name,
    email: entry.author_email,
    date: entry.date,
    message: entry.message,
  }))
}
