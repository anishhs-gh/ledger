import { Command } from 'commander'
import { generateCommand } from './commands/generate'
import { initCommand } from './commands/init'
import { VERSION } from './version'

const program = new Command()

program
  .name('ledger')
  .description('AI-powered release notes generator')
  // Bind version to lowercase -v (what people reflexively type) instead of Commander's default -V.
  .version(VERSION, '-v, --version', 'output the version number')

program.addCommand(generateCommand)
program.addCommand(initCommand)

program.parse()
