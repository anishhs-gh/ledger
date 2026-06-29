# Contributing to ledger

Thanks for your interest in improving `ledger`! This project is in public **beta**, so bug reports,
reproductions, and focused pull requests are especially welcome.

## Ways to help

- **Report a bug** — open an [issue](https://github.com/anishhs-gh/ledger/issues) with the command you
  ran, your provider/model, and the output (redact any keys). A minimal repo that reproduces it helps a lot.
- **Suggest a feature** — open an issue describing the problem first, before any code. For larger ideas,
  check the [design proposals](./docs) so we don't duplicate work.
- **Send a pull request** — see the workflow below.

## Prerequisites

- **Node.js >= 18** and npm.
- No API key is needed for development — the test suite mocks providers and never makes network calls.

## Getting started

```bash
git clone https://github.com/anishhs-gh/ledger.git
cd ledger
npm install

# Run the local quality gate (same checks CI runs)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src
npm test            # vitest
npm run build       # tsup → dist/cli.js
```

Try your build locally:

```bash
node dist/cli.js generate --help
```

`npm run dev` rebuilds on change (tsup watch). `npm run test:watch` reruns tests on change.

## Branching & pull requests (gitflow)

The default integration branch is **`develop`**; **`master`** is the release branch.

1. Branch off `develop`: `git checkout -b feat/short-description develop`.
2. Make your change with tests. Keep the diff focused — one logical change per PR.
3. Run the full gate locally (`typecheck` → `lint` → `test` → `build`) and make sure it's green.
4. Open a PR **into `develop`**. The **Dry-run publish** workflow runs `test` + `audit` and validates
   that a publish would succeed — it must pass before merge. A maintainer is auto-requested for review
   via `CODEOWNERS`.
5. Releases happen separately: `develop` → `master` via PR, then a maintainer runs the manual
   **Publish** workflow. Contributors don't publish to npm.

> Please don't bump the version or edit `CHANGELOG.md`'s released entries in a feature PR — add your
> note under the `## [Unreleased]` section and the maintainer handles versioning at release time.

## Coding guidelines

- **TypeScript**, matching the existing style. Run `npm run lint` — it must pass with no warnings.
- **Tests live in `test/`** (vitest). Add or update tests for any behavior change. Prefer pure,
  filesystem-/network-free tests like the existing ones (`test/config.test.ts`, `test/writer.test.ts`).
- **Adding an AI provider?** Follow the pattern in `src/providers/` (a factory returning an
  `AIProvider`), register it in `src/providers/index.ts`, add it to `VALID_PROVIDERS` /
  `DEFAULT_MODELS` in `src/config/loader.ts`, and update the README provider table. Note that any
  service speaking the OpenAI Chat Completions API is already covered by the `openai-compatible`
  provider — prefer that over hardcoding a new vendor unless it needs a distinct SDK or auth.
- **User-facing changes** (flags, config, behavior) must update the README and the `## [Unreleased]`
  CHANGELOG section in the same PR.

## Commit messages

Short, imperative summaries (`fix: handle empty diff range`). Conventional Commit prefixes
(`feat:`, `fix:`, `docs:`, `chore:`, `test:`) are appreciated since the notes this tool generates read
better with them — but they aren't enforced.

## Reporting security issues

Please **don't** open a public issue for a security vulnerability. Email the maintainer at
anishsh701@gmail.com instead.

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](./LICENSE).
