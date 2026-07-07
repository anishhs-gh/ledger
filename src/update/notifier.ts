import fs from 'fs'
import os from 'os'
import path from 'path'

// Non-blocking "a newer version is available" check.
//
// Designed to never cost the user time: it's cached for a day (most runs do zero network), it's
// meant to be started *concurrently with* the AI request (which always outlasts it), it hard-caps
// the network wait, and it never throws — any failure just means no notice. It's also silent in CI,
// when output isn't an interactive terminal, and when `NO_UPDATE_NOTIFIER` is set.

const PKG = '@anishhs/ledger'
// The dist-tags endpoint returns just `{ "latest": "x.y.z", ... }` — smaller and more reliable
// than fetching a full version manifest.
const REGISTRY_URL = `https://registry.npmjs.org/-/package/${PKG}/dist-tags`
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // check npm at most once a day
const FETCH_TIMEOUT_MS = 1500 // bound the network wait so it can't stall a run

interface Cache {
  checkedAt: number
  latest: string
}

export interface CheckOptions {
  now?: number
  isTty?: boolean
  cacheDir?: string
  fetchLatest?: () => Promise<string>
}

// Returns a ready-to-print notice if a newer version exists, otherwise null. Never rejects.
export async function checkForUpdate(current: string, opts: CheckOptions = {}): Promise<string | null> {
  try {
    const isTty = opts.isTty ?? Boolean(process.stderr.isTTY)
    if (!isTty || process.env.CI || process.env.NO_UPDATE_NOTIFIER) return null

    const cacheFile = path.join(opts.cacheDir ?? os.tmpdir(), 'ledger-update-check.json')
    const now = opts.now ?? Date.now()

    const cached = readCache(cacheFile)
    let latest = cached && now - cached.checkedAt < CACHE_TTL_MS ? cached.latest : undefined

    if (latest === undefined) {
      latest = await (opts.fetchLatest ?? fetchLatest)()
      writeCache(cacheFile, { checkedAt: now, latest })
    }

    return isNewer(latest, current) ? formatNotice(current, latest) : null
  } catch {
    return null // an update check must never break a run
  }
}

async function fetchLatest(): Promise<string> {
  const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`registry ${res.status}`)
  const tags = await res.json() as { latest?: string }
  if (!tags.latest) throw new Error('no latest dist-tag')
  return tags.latest
}

function readCache(file: string): Cache | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Cache
    if (typeof parsed.checkedAt === 'number' && typeof parsed.latest === 'string') return parsed
  } catch {
    // no/invalid cache — treat as a miss
  }
  return undefined
}

function writeCache(file: string, cache: Cache): void {
  try {
    fs.writeFileSync(file, JSON.stringify(cache), 'utf-8')
  } catch {
    // a non-writable temp dir just means we re-check next time — not worth surfacing
  }
}

// True when `latest` is a newer release than `current`. Compares major.minor.patch numerically and
// treats a stable release as newer than a prerelease of the same core (so beta → stable notifies).
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  if (a.patch !== b.patch) return a.patch > b.patch
  return !a.pre && Boolean(b.pre) // same core: stable beats prerelease
}

function parseVersion(v: string): { major: number; minor: number; patch: number; pre: string | null } {
  const [core, pre] = v.trim().split('-', 2)
  const [major = 0, minor = 0, patch = 0] = core.split('.').map(n => parseInt(n, 10) || 0)
  return { major, minor, patch, pre: pre ?? null }
}

function formatNotice(current: string, latest: string): string {
  return (
    `\nUpdate available: ${current} → ${latest}\n` +
    `Run \`npm i -g ${PKG}\` — or add \`@latest\` to your npx command.\n`
  )
}
