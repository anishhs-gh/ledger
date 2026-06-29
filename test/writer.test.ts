import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { composeNotes, writeNotesFile } from '../src/output/writer'

describe('composeNotes', () => {
  const notes = '# Release Notes\n\n- did a thing'

  it('overwrite returns just the notes with a single trailing newline', () => {
    expect(composeNotes('old stuff', notes, 'overwrite')).toBe(notes + '\n')
  })

  it('overwrite/append/prepend on an empty file just writes the notes', () => {
    expect(composeNotes('', notes, 'append')).toBe(notes + '\n')
    expect(composeNotes('   \n', notes, 'prepend')).toBe(notes + '\n')
  })

  it('append puts the new notes after existing content', () => {
    expect(composeNotes('# Changelog\n\n## [1.0.0]\n- old', notes, 'append')).toBe(
      '# Changelog\n\n## [1.0.0]\n- old\n\n' + notes + '\n'
    )
  })

  it('prepend inserts before the first ## heading, keeping the title/intro on top', () => {
    const existing = '# Changelog\n\nAll notable changes.\n\n## [1.0.0]\n- old'
    expect(composeNotes(existing, notes, 'prepend')).toBe(
      '# Changelog\n\nAll notable changes.\n\n' + notes + '\n\n## [1.0.0]\n- old\n'
    )
  })

  it('prepend with no ## heading goes to the very top', () => {
    expect(composeNotes('just some text', notes, 'prepend')).toBe(notes + '\n\njust some text\n')
  })
})

describe('writeNotesFile', () => {
  let file: string
  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-writer-'))
    file = path.join(dir, 'CHANGELOG.md')
  })

  it('creates the file when prepending to a path that does not exist', () => {
    writeNotesFile(file, '# Release Notes\n- x', 'prepend')
    expect(fs.readFileSync(file, 'utf-8')).toBe('# Release Notes\n- x\n')
  })

  it('prepends into an existing changelog below the title', () => {
    fs.writeFileSync(file, '# Changelog\n\n## [1.0.0]\n- old\n')
    writeNotesFile(file, '## [1.1.0]\n- new', 'prepend')
    expect(fs.readFileSync(file, 'utf-8')).toBe(
      '# Changelog\n\n## [1.1.0]\n- new\n\n## [1.0.0]\n- old\n'
    )
  })
})
