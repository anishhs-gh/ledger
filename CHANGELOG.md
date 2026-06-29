# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta.0] - 2026-06-29

First public **beta**. Functionally complete; published under the npm `beta` dist-tag for testing
ahead of a stable `1.0.0`. Interfaces, flags, and generated output may still change based on feedback.

`ledger` generates AI-powered release notes from git history — analysing
commits **and** the actual code diffs — and runs identically on a laptop or in any CI.

### Added

- **`ledger generate`** — release notes from git history, with range selection
  (`--since-last-tag`, `--from`/`--to`, `--last N`).
- **Commit collection and diff analysis** (added/modified/deleted/renamed files, line counts).
- **Smart context reduction** with per-file and total caps to control token usage.
- **Audience modes**: `engineering`, `business`, `qa`.
- **Output formats**: Markdown and JSON (notes on stdout, progress on stderr), plus
  `-o, --output-file` with `--append` / `--prepend` — prepend inserts below a leading `#` title, so
  `ledger generate -o CHANGELOG.md --prepend` maintains a changelog in place (a missing file is created).
- **Providers (BYOK)**: OpenAI, Anthropic, Gemini, OpenRouter, Ollama, Bedrock, plus an
  **`openai-compatible`** provider for any service speaking the OpenAI Chat Completions API (Groq,
  Together, Fireworks, DeepSeek, Mistral, xAI, Perplexity, Azure OpenAI, or a self-hosted
  vLLM/LiteLLM/LocalAI server) — set `baseURL` (config / `LEDGER_BASE_URL` / `--base-url`), a `model`,
  and a key from `LEDGER_API_KEY` (or a custom var via `apiKeyEnv`); also exposed via the GitHub
  Action `base-url` input.
- **YAML/JSON config loader** and **`ledger init`** to scaffold a config file. Config options:
  `provider`, `model`, `maxDiffLines`, `maxTokens`, `timeout`, `maxRetries`.
- **CI auto-detection** for GitHub Actions, GitLab CI, Jenkins, CircleCI, Buildkite, and a
  generic `CI` fallback. With no range flag, the range is derived automatically: a tag build
  uses _previous tag → this tag_; a PR/MR build uses _base branch → HEAD_.
- **CI output enrichment**: repository, ref, and pipeline URL in the notes header, and on
  GitHub the notes are appended to the job **step summary** (`$GITHUB_STEP_SUMMARY`), with a
  `--no-summary` opt-out.
- **Operational flags**: `--quiet`, `--dry-run` (assemble context + estimate tokens without
  calling the AI), `--max-tokens`, `--timeout`, `--fail-on-empty`.
- **Documented exit-code contract**: `0` success, `1` runtime error, `2` usage/config/auth
  error, `3` empty range with `--fail-on-empty`.
- **Resilience**: per-request timeout plus automatic retry with exponential backoff and
  jitter on transient errors (429/5xx/network) across all providers.
- **Composite GitHub Action** (`action.yml`) and copy-paste templates for GitLab CI,
  Jenkins, and generic runners under [`examples/`](./examples).
- **Tooling**: vitest test suite, ESLint configuration, a matrix CI workflow
  (Node 18/20/22 → typecheck → lint → test → build), and a publish-on-tag release workflow
  with npm provenance.

[Unreleased]: https://github.com/anishhs-gh/ledger/compare/v1.0.0-beta.0...HEAD
[1.0.0-beta.0]: https://github.com/anishhs-gh/ledger/releases/tag/v1.0.0-beta.0
