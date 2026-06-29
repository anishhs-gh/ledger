import simpleGit, { type SimpleGit } from 'simple-git'
import { CliError, EXIT } from '../errors'
import type { CiContext } from '../ci/detect'
import type { Commit } from '../types'

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
    const from = await getLastTag(git)
    return { from, to }
  }

  if (opts.last !== undefined) {
    return { from: `HEAD~${opts.last}`, to }
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
  // Tag build: previous tag .. this tag. Fall back to repo root if it's the first tag.
  if (ctx.tag) {
    const prevTag = await getPreviousTag(git, ctx.tag)
    const from = prevTag ?? (await getRootCommit(git))
    if (!from) return null
    return { from, to: ctx.tag }
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

async function getPreviousTag(git: SimpleGit, tag: string): Promise<string | null> {
  try {
    const result = await git.raw(['describe', '--tags', '--abbrev=0', `${tag}^`])
    return result.trim() || null
  } catch {
    return null
  }
}

async function getRootCommit(git: SimpleGit): Promise<string | null> {
  try {
    const result = await git.raw(['rev-list', '--max-parents=0', 'HEAD'])
    return result.trim().split('\n')[0] || null
  } catch {
    return null
  }
}

async function getLastTag(git: SimpleGit): Promise<string> {
  try {
    const result = await git.raw(['describe', '--tags', '--abbrev=0'])
    return result.trim()
  } catch {
    throw new CliError(
      'No git tags found. Create a tag first, or use --from to specify a starting point.',
      EXIT.USAGE
    )
  }
}

export async function collectCommits(
  git: SimpleGit,
  from: string,
  to: string
): Promise<Commit[]> {
  const log = await git.log({ from, to })
  return log.all.map(entry => ({
    sha: entry.hash,
    shortSha: entry.hash.slice(0, 7),
    author: entry.author_name,
    email: entry.author_email,
    date: entry.date,
    message: entry.message,
  }))
}
