import { Command } from 'commander'
import path from 'path'
import { loadConfig } from '../config/loader'
import { createGit, resolveRange, resolveCiRange, collectCommits } from '../git/collector'
import { analyzeDiff } from '../git/diff'
import { reduceContext } from '../context/reducer'
import { buildPrompt } from '../prompts/generate'
import { createProvider } from '../providers'
import { formatOutput } from '../output/formatter'
import { writeNotesFile } from '../output/writer'
import { detectCi } from '../ci/detect'
import { writeStepSummary } from '../ci/summary'
import { CliError, EXIT, exitCodeFor } from '../errors'
import type { ChangeAnalysis, Audience, OutputFormat, WriteMode } from '../types'

const intArg = (v: string) => parseInt(v, 10)

export const generateCommand = new Command('generate')
  .description('Generate release notes from git history')
  .option('--since-last-tag', 'Generate notes since the last git tag (default when no range given)')
  .option('--from <ref>', 'Start from this git ref (tag, branch, or SHA)')
  .option('--to <ref>', 'End at this git ref (default: HEAD)')
  .option('--last <n>', 'Include last N commits', intArg)
  .option('--audience <mode>', 'Target audience: engineering, business, qa', 'engineering')
  .option('--output <format>', 'Output format: markdown, json', 'markdown')
  .option('-o, --output-file <path>', 'Write notes to a file instead of (only) stdout')
  .option('--append', 'Append the notes to the end of --output-file (newest at the bottom)')
  .option('--prepend', 'Prepend the notes to --output-file (newest on top, below any # title)')
  .option('--stdout', 'Also echo the notes to stdout when writing to --output-file')
  .option('--config <path>', 'Path to config file')
  .option('--provider <name>', 'AI provider override')
  .option('--model <name>', 'AI model override')
  .option('--base-url <url>', 'OpenAI-compatible API base URL (for --provider openai-compatible)')
  .option('--max-tokens <n>', 'Max tokens for the AI response', intArg)
  .option('--timeout <ms>', 'Per-request timeout in milliseconds', intArg)
  .option('--quiet', 'Suppress progress output on stderr (errors still shown)')
  .option('--dry-run', 'Assemble context and print a token estimate without calling the AI')
  .option('--fail-on-empty', 'Exit non-zero when there are no changes in the range')
  .option('--no-summary', 'Do not write to the CI step summary even when one is detected')
  .action(async (opts) => {
    const log = (msg: string) => {
      if (!opts.quiet) process.stderr.write(msg)
    }

    try {
      // Resolve the write mode up front and validate it before doing any work.
      if (opts.append && opts.prepend) {
        throw new CliError('Use either --append or --prepend, not both.', EXIT.USAGE)
      }
      const writeMode: WriteMode = opts.append ? 'append' : opts.prepend ? 'prepend' : 'overwrite'
      if (writeMode !== 'overwrite') {
        if (!opts.outputFile) {
          throw new CliError('--append/--prepend require --output-file <path>.', EXIT.USAGE)
        }
        if (opts.output === 'json') {
          throw new CliError('--append/--prepend only work with markdown output, not JSON.', EXIT.USAGE)
        }
      }

      const config = loadConfig({
        configPath: opts.config,
        provider: opts.provider,
        model: opts.model,
        baseURL: opts.baseUrl,
        maxTokens: opts.maxTokens,
        timeout: opts.timeout,
      })

      const git = await createGit()
      const ci = detectCi()

      const explicitRange =
        opts.from || opts.to || opts.sinceLastTag || opts.last !== undefined

      let range: { from: string; to: string } | null = null
      if (!explicitRange && ci.isCI) {
        range = await resolveCiRange(git, ci)
        if (range) log(`Detected ${ci.runner} CI — using range ${range.from}..${range.to}\n`)
      }
      if (!range) {
        range = await resolveRange(git, {
          from: opts.from,
          to: opts.to,
          sinceLastTag: opts.sinceLastTag,
          last: opts.last,
        })
      }
      const { from, to } = range

      log(`Analysing ${from}..${to}\n`)

      const [commits, files] = await Promise.all([
        collectCommits(git, from, to),
        analyzeDiff(git, from, to),
      ])

      if (commits.length === 0 && files.length === 0) {
        log('No changes found in the specified range.\n')
        process.exit(opts.failOnEmpty ? EXIT.EMPTY : EXIT.OK)
      }

      const totalLinesAdded = files.reduce((n, f) => n + f.linesAdded, 0)
      const totalLinesRemoved = files.reduce((n, f) => n + f.linesRemoved, 0)

      const analysis: ChangeAnalysis = {
        from, to, commits, files,
        totalLinesAdded, totalLinesRemoved,
      }

      const context = reduceContext(analysis, config.maxDiffLines)
      const prompt = buildPrompt(context, opts.audience as Audience)

      if (opts.dryRun) {
        const estTokens = Math.ceil(prompt.length / 4)
        log(
          `Dry run — ${commits.length} commit(s), ${files.length} file(s). ` +
          `Prompt ~${prompt.length} chars (~${estTokens} tokens). No AI call made.\n`
        )
        process.stdout.write(prompt + '\n')
        return
      }

      log(
        `Found ${commits.length} commit(s), ${files.length} file(s) changed. ` +
        `Generating with ${config.provider}/${config.model}...\n`
      )

      const provider = createProvider(config)
      const content = await provider.complete(prompt)

      const notes = {
        title: 'Release Notes',
        date: new Date().toISOString().split('T')[0],
        range: `${from}...${to}`,
        audience: opts.audience as Audience,
        commits: commits.length,
        filesChanged: files.length,
        content,
        repo: ci.repo,
        ref: ci.refName,
        runUrl: ci.runUrl,
      }

      const rendered = formatOutput(notes, opts.output as OutputFormat) + '\n'

      if (opts.outputFile) {
        const dest = path.resolve(opts.outputFile)
        writeNotesFile(dest, rendered, writeMode)
        const verb = writeMode === 'append' ? 'Appended to' : writeMode === 'prepend' ? 'Prepended to' : 'Wrote'
        log(`${verb} ${dest}\n`)
        // The file is the output; only echo to stdout when explicitly asked (--stdout).
        if (opts.stdout) process.stdout.write(rendered)
      } else {
        process.stdout.write(rendered)
      }

      // commander maps --no-summary to opts.summary === false
      const wroteSummary = writeStepSummary(ci, formatOutput(notes, 'markdown') + '\n', opts.summary !== false)
      if (wroteSummary) log(`Appended release notes to CI step summary\n`)
    } catch (err) {
      const message = err instanceof CliError ? err.message : (err as Error).message
      process.stderr.write(`Error: ${message}\n`)
      process.exit(exitCodeFor(err))
    }
  })
