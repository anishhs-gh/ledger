import { Command } from 'commander'
import { generateCommand } from './commands/generate'
import { initCommand } from './commands/init'

// Single-source the version from package.json (inlined at build time by tsup).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('ledger')
  .description('AI-powered release notes generator')
  .version(version)

program.addCommand(generateCommand)
program.addCommand(initCommand)

program.parse()
