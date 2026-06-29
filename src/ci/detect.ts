// Pure env -> CI-context mapping. No git, no IO — trivially unit-testable.

export type Runner = 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'buildkite' | 'generic'

export interface CiContext {
  isCI: boolean
  runner: Runner | null
  repo?: string // "owner/repo" when available
  refType?: 'tag' | 'branch'
  refName?: string // branch or tag name
  tag?: string // current tag when this is a tag build
  baseRef?: string // PR/MR target branch when this is a PR/MR build
  runUrl?: string // link back to the running job/pipeline
  stepSummaryFile?: string // file to append a markdown summary to (GitHub)
}

type Env = NodeJS.ProcessEnv

export function detectCi(env: Env = process.env): CiContext {
  if (env.GITHUB_ACTIONS === 'true') return github(env)
  if (env.GITLAB_CI === 'true') return gitlab(env)
  if (env.JENKINS_URL) return jenkins(env)
  if (env.CIRCLECI === 'true') return circleci(env)
  if (env.BUILDKITE === 'true') return buildkite(env)
  if (truthy(env.CI)) return { isCI: true, runner: 'generic' }
  return { isCI: false, runner: null }
}

function github(env: Env): CiContext {
  const refType = env.GITHUB_REF_TYPE === 'tag' ? 'tag' : env.GITHUB_REF_TYPE === 'branch' ? 'branch' : undefined
  const server = env.GITHUB_SERVER_URL ?? 'https://github.com'
  const runUrl = env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${server}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : undefined

  return {
    isCI: true,
    runner: 'github',
    repo: env.GITHUB_REPOSITORY || undefined,
    refType,
    refName: env.GITHUB_REF_NAME || undefined,
    tag: refType === 'tag' ? env.GITHUB_REF_NAME || undefined : undefined,
    baseRef: env.GITHUB_BASE_REF || undefined,
    runUrl,
    stepSummaryFile: env.GITHUB_STEP_SUMMARY || undefined,
  }
}

function gitlab(env: Env): CiContext {
  const tag = env.CI_COMMIT_TAG || undefined
  return {
    isCI: true,
    runner: 'gitlab',
    repo: env.CI_PROJECT_PATH || undefined,
    refType: tag ? 'tag' : 'branch',
    refName: env.CI_COMMIT_REF_NAME || undefined,
    tag,
    baseRef: env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || undefined,
    runUrl: env.CI_PIPELINE_URL || undefined,
  }
}

function jenkins(env: Env): CiContext {
  const tag = env.TAG_NAME || undefined
  return {
    isCI: true,
    runner: 'jenkins',
    repo: env.JOB_NAME || undefined,
    refType: tag ? 'tag' : 'branch',
    refName: stripOrigin(env.GIT_BRANCH) || undefined,
    tag,
    baseRef: env.CHANGE_TARGET || undefined,
    runUrl: env.BUILD_URL || undefined,
  }
}

function circleci(env: Env): CiContext {
  const tag = env.CIRCLE_TAG || undefined
  const repo = env.CIRCLE_PROJECT_USERNAME && env.CIRCLE_PROJECT_REPONAME
    ? `${env.CIRCLE_PROJECT_USERNAME}/${env.CIRCLE_PROJECT_REPONAME}`
    : undefined
  return {
    isCI: true,
    runner: 'circleci',
    repo,
    refType: tag ? 'tag' : 'branch',
    refName: env.CIRCLE_BRANCH || undefined,
    tag,
    runUrl: env.CIRCLE_BUILD_URL || undefined,
  }
}

function buildkite(env: Env): CiContext {
  const tag = env.BUILDKITE_TAG || undefined
  return {
    isCI: true,
    runner: 'buildkite',
    repo: env.BUILDKITE_REPO || undefined,
    refType: tag ? 'tag' : 'branch',
    refName: env.BUILDKITE_BRANCH || undefined,
    tag,
    baseRef: env.BUILDKITE_PULL_REQUEST_BASE_BRANCH || undefined,
    runUrl: env.BUILDKITE_BUILD_URL || undefined,
  }
}

function stripOrigin(ref?: string): string | undefined {
  if (!ref) return undefined
  return ref.replace(/^origin\//, '')
}

function truthy(v?: string): boolean {
  return v !== undefined && v !== '' && v !== 'false' && v !== '0'
}
