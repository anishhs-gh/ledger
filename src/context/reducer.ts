import type { ChangeAnalysis } from '../types'

const MAX_DIFF_CHARS_PER_FILE = 3000
const MAX_TOTAL_CONTEXT_CHARS = 80000

export function reduceContext(analysis: ChangeAnalysis, maxDiffLines?: number): string {
  const maxPerFile = maxDiffLines
    ? maxDiffLines * 80
    : MAX_DIFF_CHARS_PER_FILE

  const parts: string[] = []

  parts.push(`## Summary
- Range: ${analysis.from} → ${analysis.to}
- Commits: ${analysis.commits.length}
- Files changed: ${analysis.files.length}
- Lines: +${analysis.totalLinesAdded} -${analysis.totalLinesRemoved}`)

  parts.push('\n## Commits')
  for (const c of analysis.commits) {
    parts.push(`- ${c.shortSha} ${c.message} (${c.author}, ${fmtDate(c.date)})`)
  }

  parts.push('\n## Files Changed')
  for (const f of analysis.files) {
    const label = f.operation === 'renamed' ? `renamed → ${f.newPath}` : f.operation
    parts.push(`- [${label}] ${f.path} (+${f.linesAdded} -${f.linesRemoved})`)
  }

  parts.push('\n## Diffs')
  let totalChars = parts.join('\n').length
  let omitted = 0

  for (const file of analysis.files) {
    if (totalChars >= MAX_TOTAL_CONTEXT_CHARS) {
      omitted++
      continue
    }

    let content = file.diff
    let truncated = false

    if (content.length > maxPerFile) {
      content = content.slice(0, maxPerFile)
      const lastNl = content.lastIndexOf('\n')
      if (lastNl > 0) content = content.slice(0, lastNl)
      truncated = true
    }

    const header = `\n### ${file.path} [${file.operation}]${truncated ? ' (truncated)' : ''}`
    parts.push(header)
    parts.push('```diff')
    parts.push(content)
    parts.push('```')

    totalChars += header.length + content.length + 12
  }

  if (omitted > 0) {
    parts.push(`\n[${omitted} additional file(s) omitted — context limit reached]`)
  }

  return parts.join('\n')
}

function fmtDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}
