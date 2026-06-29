import type { ReleaseNotes, OutputFormat } from '../types'

export function formatOutput(notes: ReleaseNotes, format: OutputFormat): string {
  if (format === 'json') {
    return JSON.stringify(notes, null, 2)
  }

  const lines = [
    `# Release Notes`,
    ``,
    `**Date:** ${notes.date}`,
    `**Range:** ${notes.range}`,
    `**Commits:** ${notes.commits} | **Files Changed:** ${notes.filesChanged}`,
    `**Audience:** ${capitalize(notes.audience)}`,
  ]

  if (notes.repo) lines.push(`**Repository:** ${notes.repo}`)
  if (notes.ref) lines.push(`**Ref:** ${notes.ref}`)
  if (notes.runUrl) lines.push(`**Pipeline:** ${notes.runUrl}`)

  lines.push(``, `---`, ``, notes.content)
  return lines.join('\n')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
