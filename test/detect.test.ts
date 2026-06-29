import { describe, it, expect } from 'vitest'
import { detectCi } from '../src/ci/detect'

describe('detectCi', () => {
  it('returns non-CI for an empty environment', () => {
    expect(detectCi({})).toEqual({ isCI: false, runner: null })
  })

  it('detects a GitHub Actions tag build with run URL and step summary', () => {
    const ctx = detectCi({
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'acme/widgets',
      GITHUB_REF_TYPE: 'tag',
      GITHUB_REF_NAME: 'v1.2.0',
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_RUN_ID: '99',
      GITHUB_STEP_SUMMARY: '/tmp/summary.md',
    })
    expect(ctx.runner).toBe('github')
    expect(ctx.repo).toBe('acme/widgets')
    expect(ctx.refType).toBe('tag')
    expect(ctx.tag).toBe('v1.2.0')
    expect(ctx.runUrl).toBe('https://github.com/acme/widgets/actions/runs/99')
    expect(ctx.stepSummaryFile).toBe('/tmp/summary.md')
  })

  it('detects a GitHub PR build with a base ref and no tag', () => {
    const ctx = detectCi({
      GITHUB_ACTIONS: 'true',
      GITHUB_REF_TYPE: 'branch',
      GITHUB_REF_NAME: 'feature/x',
      GITHUB_BASE_REF: 'main',
    })
    expect(ctx.tag).toBeUndefined()
    expect(ctx.baseRef).toBe('main')
  })

  it('detects a GitLab tag build', () => {
    const ctx = detectCi({
      GITLAB_CI: 'true',
      CI_COMMIT_TAG: 'v2.0.0',
      CI_PROJECT_PATH: 'group/proj',
      CI_PIPELINE_URL: 'https://gitlab.com/group/proj/-/pipelines/1',
    })
    expect(ctx.runner).toBe('gitlab')
    expect(ctx.refType).toBe('tag')
    expect(ctx.tag).toBe('v2.0.0')
    expect(ctx.runUrl).toBe('https://gitlab.com/group/proj/-/pipelines/1')
  })

  it('detects Jenkins and strips the origin/ prefix from the branch', () => {
    const ctx = detectCi({ JENKINS_URL: 'http://j', GIT_BRANCH: 'origin/dev', BUILD_URL: 'http://b/1' })
    expect(ctx.runner).toBe('jenkins')
    expect(ctx.refName).toBe('dev')
    expect(ctx.runUrl).toBe('http://b/1')
  })

  it('falls back to the generic runner when only CI is set', () => {
    expect(detectCi({ CI: 'true' })).toEqual({ isCI: true, runner: 'generic' })
  })

  it('treats CI=false / CI=0 as not in CI', () => {
    expect(detectCi({ CI: 'false' }).isCI).toBe(false)
    expect(detectCi({ CI: '0' }).isCI).toBe(false)
  })
})
