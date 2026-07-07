import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { checkForUpdate, isNewer } from '../src/update/notifier'

describe('isNewer', () => {
  it('compares major.minor.patch numerically', () => {
    expect(isNewer('2.0.0', '1.9.9')).toBe(true)
    expect(isNewer('1.1.0', '1.0.9')).toBe(true)
    expect(isNewer('1.0.1', '1.0.0')).toBe(true)
    expect(isNewer('1.0.0', '1.0.0')).toBe(false)
    expect(isNewer('1.0.0', '1.0.1')).toBe(false)
    expect(isNewer('1.10.0', '1.9.0')).toBe(true) // not string comparison
  })

  it('treats a stable release as newer than a prerelease of the same core', () => {
    expect(isNewer('1.0.0', '1.0.0-beta.1')).toBe(true)
    expect(isNewer('1.0.0-beta.2', '1.0.0-beta.1')).toBe(false) // no prerelease ordering
  })
})

describe('checkForUpdate', () => {
  const savedEnv = { ...process.env }
  let cacheDir: string

  beforeEach(() => {
    delete process.env.CI
    delete process.env.NO_UPDATE_NOTIFIER
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'))
  })
  afterEach(() => {
    process.env = { ...savedEnv }
    fs.rmSync(cacheDir, { recursive: true, force: true })
  })

  const opts = (extra = {}) => ({ isTty: true, cacheDir, fetchLatest: vi.fn(async () => '2.0.0'), ...extra })

  it('returns a notice (with both versions) when a newer version is published', async () => {
    const notice = await checkForUpdate('1.0.0', opts())
    expect(notice).toMatch(/1\.0\.0/)
    expect(notice).toMatch(/2\.0\.0/)
    expect(notice).toMatch(/Update available/i)
  })

  it('returns null when already on the latest', async () => {
    expect(await checkForUpdate('2.0.0', opts())).toBeNull()
  })

  it('does nothing (and no network) when stderr is not a TTY', async () => {
    const fetchLatest = vi.fn(async () => '2.0.0')
    expect(await checkForUpdate('1.0.0', opts({ isTty: false, fetchLatest }))).toBeNull()
    expect(fetchLatest).not.toHaveBeenCalled()
  })

  it('does nothing (and no network) in CI', async () => {
    process.env.CI = 'true'
    const fetchLatest = vi.fn(async () => '2.0.0')
    expect(await checkForUpdate('1.0.0', opts({ fetchLatest }))).toBeNull()
    expect(fetchLatest).not.toHaveBeenCalled()
  })

  it('respects NO_UPDATE_NOTIFIER', async () => {
    process.env.NO_UPDATE_NOTIFIER = '1'
    const fetchLatest = vi.fn(async () => '2.0.0')
    expect(await checkForUpdate('1.0.0', opts({ fetchLatest }))).toBeNull()
    expect(fetchLatest).not.toHaveBeenCalled()
  })

  it('serves a fresh cache without hitting the network, then persists a new check', async () => {
    const now = Date.now()
    fs.writeFileSync(path.join(cacheDir, 'ledger-update-check.json'), JSON.stringify({ checkedAt: now, latest: '3.0.0' }))
    const fetchLatest = vi.fn(async () => '2.0.0')

    const notice = await checkForUpdate('1.0.0', opts({ now, fetchLatest }))
    expect(notice).toMatch(/3\.0\.0/) // used the cached latest, not the fetch
    expect(fetchLatest).not.toHaveBeenCalled()
  })

  it('re-fetches when the cache is stale and writes the new result', async () => {
    const stale = Date.now() - 2 * 24 * 60 * 60 * 1000
    const cacheFile = path.join(cacheDir, 'ledger-update-check.json')
    fs.writeFileSync(cacheFile, JSON.stringify({ checkedAt: stale, latest: '1.0.0' }))
    const fetchLatest = vi.fn(async () => '2.0.0')

    const notice = await checkForUpdate('1.0.0', opts({ fetchLatest }))
    expect(fetchLatest).toHaveBeenCalledTimes(1)
    expect(notice).toMatch(/2\.0\.0/)
    expect(JSON.parse(fs.readFileSync(cacheFile, 'utf-8')).latest).toBe('2.0.0')
  })

  it('never throws — a failing fetch just yields no notice', async () => {
    const fetchLatest = vi.fn(async () => { throw new Error('network down') })
    expect(await checkForUpdate('1.0.0', opts({ fetchLatest }))).toBeNull()
  })
})
