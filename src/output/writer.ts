import fs from 'fs'
import type { WriteMode } from '../types'

// Compose the final file contents for a given write mode. Pure + exported so the
// append/prepend behaviour can be unit-tested without touching the filesystem.
//
// - overwrite: just the new notes.
// - append:    existing content, then the new notes (newest at the bottom).
// - prepend:   the new notes inserted before the first `## ` heading, so a
//              "Keep a Changelog"-style file keeps its `# Title` + intro on top and
//              the newest entry lands above the previous ones. With no `## ` heading
//              the notes go to the very top.
export function composeNotes(existing: string, rendered: string, mode: WriteMode): string {
  const block = rendered.replace(/\s+$/, '')
  const prev = existing.replace(/\s+$/, '')

  if (mode === 'overwrite' || !prev) return block + '\n'
  if (mode === 'append') return prev + '\n\n' + block + '\n'

  // prepend
  const idx = existing.search(/^## /m)
  if (idx === -1) return block + '\n\n' + prev + '\n'

  const head = existing.slice(0, idx).replace(/\s+$/, '')
  const rest = existing.slice(idx).replace(/\s+$/, '')
  const headPart = head ? head + '\n\n' : ''
  return headPart + block + '\n\n' + rest + '\n'
}

export function writeNotesFile(dest: string, rendered: string, mode: WriteMode): void {
  const existing =
    (mode === 'append' || mode === 'prepend') && fs.existsSync(dest)
      ? fs.readFileSync(dest, 'utf-8')
      : ''
  fs.writeFileSync(dest, composeNotes(existing, rendered, mode), 'utf-8')
}
