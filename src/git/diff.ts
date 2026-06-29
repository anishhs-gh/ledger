import type { SimpleGit } from 'simple-git'
import type { FileDiff } from '../types'

export async function analyzeDiff(
  git: SimpleGit,
  from: string,
  to: string
): Promise<FileDiff[]> {
  const rawDiff = await git.diff([`${from}..${to}`])
  if (!rawDiff.trim()) return []
  return parseDiff(rawDiff)
}

function parseDiff(rawDiff: string): FileDiff[] {
  const files: FileDiff[] = []
  const sections = rawDiff.split(/(?=^diff --git )/m).filter(s => s.trim())

  for (const section of sections) {
    const headerMatch = section.match(/^diff --git a\/(.*?) b\/(.*?)$/m)
    if (!headerMatch) continue

    const aPath = headerMatch[1].trim()
    const bPath = headerMatch[2].trim()

    let operation: FileDiff['operation'] = 'modified'
    let filePath = bPath
    let newPath: string | undefined

    if (/^new file mode/m.test(section)) {
      operation = 'added'
    } else if (/^deleted file mode/m.test(section)) {
      operation = 'deleted'
      filePath = aPath
    } else if (aPath !== bPath) {
      operation = 'renamed'
      newPath = bPath
      filePath = aPath
    }

    let linesAdded = 0
    let linesRemoved = 0
    for (const line of section.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) linesAdded++
      if (line.startsWith('-') && !line.startsWith('---')) linesRemoved++
    }

    files.push({
      path: filePath,
      operation,
      newPath,
      linesAdded,
      linesRemoved,
      diff: section,
      truncated: false,
    })
  }

  return files
}
