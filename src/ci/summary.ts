import fs from 'fs'
import type { CiContext } from './detect'

// Appends rendered release notes to the CI step summary file when one is
// available (e.g. $GITHUB_STEP_SUMMARY) and the feature is enabled.
// Returns true when something was written.
export function writeStepSummary(ctx: CiContext, markdown: string, enabled: boolean): boolean {
  if (!enabled || !ctx.stepSummaryFile) return false
  const content = markdown.endsWith('\n') ? markdown : `${markdown}\n`
  fs.appendFileSync(ctx.stepSummaryFile, content, 'utf-8')
  return true
}
