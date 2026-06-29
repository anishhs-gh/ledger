<p align="center">
  <img src="https://raw.githubusercontent.com/anishhs-gh/ledger/master/ledger.svg" alt="ledger" width="80" />
</p>

<h1 align="center">ledger</h1>

[![npm beta](https://img.shields.io/npm/v/@anishhs/ledger/beta.svg)](https://www.npmjs.com/package/@anishhs/ledger)
[![CI](https://github.com/anishhs-gh/ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/anishhs-gh/ledger/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/@anishhs/ledger.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@anishhs/ledger.svg)](https://nodejs.org)

**AI-powered release notes, generated from your git history — locally or in any CI.**

`ledger` analyses your commits **and the actual code diffs**, reduces them into a focused
context, and asks the AI provider of your choice to write release notes tailored to a
specific audience (engineering, business, or QA). Bring your own API key; no vendor lock-in.

```bash
npx @anishhs/ledger@beta generate --since-last-tag
```

> [!IMPORTANT]
> **Beta.** `ledger` is in public beta, published under the npm `beta` dist-tag — install with
> **`@beta`** (a plain `@anishhs/ledger` won't resolve until the stable `1.0.0`). Flags and generated
> output may still change. Found a rough edge? Please [open an issue](https://github.com/anishhs-gh/ledger/issues).

---

## Why

Most changelog tools just reformat commit messages. `ledger` reads the diff too, so the
notes describe *what actually changed* — not just what someone typed in a commit subject.

- **Provider-agnostic (BYOK):** OpenAI, Anthropic, Gemini, OpenRouter, Ollama, Bedrock.
- **CI-first, local-friendly:** the same command works on your laptop and inside GitHub
  Actions, GitLab CI, Jenkins, or any runner — auto-detecting the environment and range.
- **Robust:** per-request timeouts, automatic retry with backoff, and a documented
  exit-code contract so pipelines behave predictably.
- **Cheap to preview:** `--dry-run` assembles the context and estimates tokens without
  spending anything.

## Install

No install needed — run it with `npx`:

```bash
npx @anishhs/ledger@beta generate --since-last-tag
```

Or install globally:

```bash
npm install -g @anishhs/ledger@beta
ledger generate --since-last-tag
```

> During the beta, keep the `@beta` tag on every install/`npx` command. Drop it once stable `1.0.0` ships.

## Quickstart

```bash
# 1. Scaffold a config file
ledger init

# 2. Set the API key for your chosen provider
export OPENAI_API_KEY=sk-...

# 3. Generate notes for everything since the last git tag
ledger generate --since-last-tag > RELEASE_NOTES.md
```

## Usage

```bash
ledger generate [options]
```

### Selecting a range

| Flag | Description |
| --- | --- |
| `--since-last-tag` | From the last git tag to `HEAD` (default when no range is given) |
| `--from <ref>` | Start from a tag, branch, or SHA |
| `--to <ref>` | End ref (default: `HEAD`) |
| `--last <n>` | Include the last N commits |

In CI, if you pass **no** range flag, `ledger` derives one automatically:
a tag build uses *previous tag → this tag*; a PR/MR build uses *base branch → HEAD*.

### Output & behaviour

| Flag | Description |
| --- | --- |
| `--audience <mode>` | `engineering` (default), `business`, or `qa` |
| `--output <format>` | `markdown` (default) or `json` |
| `-o, --output-file <path>` | Write notes to a file (still echoes to stdout unless `--quiet`). Optional — omit it and notes go to **stdout** |
| `--append` | Append to `--output-file` instead of overwriting (newest at the bottom) |
| `--prepend` | Prepend to `--output-file` (newest on top, inserted below a leading `#` title) — ideal for a `CHANGELOG.md` |
| `--max-tokens <n>` | Max tokens for the AI response |
| `--timeout <ms>` | Per-request timeout (default 60000) |
| `--quiet` | Suppress progress on stderr (errors still shown) |
| `--dry-run` | Assemble context + estimate tokens, **without** calling the AI |
| `--fail-on-empty` | Exit non-zero when there are no changes in the range |
| `--no-summary` | Don't write to the CI step summary even when one is detected |
| `--provider <name>` / `--model <name>` | Override the configured provider/model |
| `--config <path>` | Path to a config file |

Notes are written to **stdout**; all progress/logging goes to **stderr**, so
`ledger generate > NOTES.md` is always clean.

## Configuration

Create `ledger.config.yaml` (or run `ledger init`):

```yaml
provider: openai      # openai | anthropic | gemini | openrouter | ollama | bedrock | openai-compatible
model: gpt-4o         # optional — a sensible default is used per provider (required for openai-compatible)
# audience: engineering
# maxDiffLines: 100   # cap per-file diff lines sent to the AI (reduces tokens)
# maxTokens: 4096
# timeout: 60000
# maxRetries: 3
```

**Precedence (highest first):** `LEDGER_PROVIDER` / `LEDGER_MODEL` env vars → CLI flags →
config file → built-in defaults.

### Updating a CHANGELOG in place

`--output-file` overwrites by default. Use `--prepend` to drop the new notes at the top of an
existing changelog (below its `#` title), or `--append` to add them at the bottom:

```bash
ledger generate --since-last-tag -o CHANGELOG.md --prepend
```

A fresh file is created if it doesn't exist yet. (`--append`/`--prepend` need `--output-file` and
markdown output.)

### Providers & keys

| Provider | Env var | Notes |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | |
| Anthropic | `ANTHROPIC_API_KEY` | |
| Gemini | `GEMINI_API_KEY` | |
| OpenRouter | `OPENROUTER_API_KEY` | |
| Ollama | — | local; set `OLLAMA_BASE_URL` to override `http://localhost:11434/v1` |
| Bedrock | `BEDROCK_API_KEY` *or* AWS IAM (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, …) | |
| **OpenAI-compatible** | `LEDGER_API_KEY` (or your own via `apiKeyEnv`) | **Any other service** — set `baseURL`. See below. |

### Use any OpenAI-compatible provider

Not locked to the six above. Most inference services — **Groq, Together, Fireworks, DeepSeek,
Mistral, xAI, Perplexity, Azure OpenAI**, or a self-hosted **vLLM / LiteLLM / LocalAI** server —
expose the OpenAI Chat Completions API. Point `ledger` at any of them with the `openai-compatible`
provider: give it a **base URL**, a **model**, and (usually) an **API key**.

```bash
export LEDGER_API_KEY=gsk_...
ledger generate --since-last-tag \
  --provider openai-compatible \
  --base-url https://api.groq.com/openai/v1 \
  --model llama-3.3-70b-versatile
```

Or in `ledger.config.yaml`:

```yaml
provider: openai-compatible
baseURL: https://api.groq.com/openai/v1   # or LEDGER_BASE_URL / --base-url
model: llama-3.3-70b-versatile
# apiKeyEnv: GROQ_API_KEY   # optional — read the key from a different env var (default LEDGER_API_KEY)
# headers:                  # optional — extra request headers
#   X-Title: my-app
```

The key is read from `LEDGER_API_KEY` unless you name another var via `apiKeyEnv`. A purely local
server that needs no key works without one.

## Use in CI

`ledger` auto-detects the runner (GitHub Actions, GitLab CI, Jenkins, CircleCI, Buildkite,
or a generic `CI`) and, when you pass no range flag, derives one: a **tag build** uses
*previous tag → this tag*; a **PR/MR build** uses *base branch → HEAD*. On GitHub it also
appends the notes to the run's **step summary**.

> Two requirements on every runner: **full git history + tags** (CI often shallow-clones —
> see below) and a **provider API key** from your secret store.

### GitHub Actions (composite action)

```yaml
name: Release notes
on:
  push:
    tags: ['v*']
jobs:
  notes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history + tags so the range can be derived
      - uses: anishhs-gh/ledger@v1.0.0-beta.0
        with:
          provider: openai
          api-key: ${{ secrets.OPENAI_API_KEY }}
          output-file: RELEASE_NOTES.md
          package: '@anishhs/ledger@beta' # beta only; drop at stable v1
```

> **Beta:** pin the action to `anishhs-gh/ledger@v1.0.0-beta.0` (the floating `@v1` tag arrives with stable
> `1.0.0`) and set `package: '@anishhs/ledger@beta'` so it runs the beta build. At stable, use
> `anishhs-gh/ledger@v1` and the default `package`.

**Action inputs:**

| Input | Default | Description |
| --- | --- | --- |
| `provider` | — | `openai` \| `anthropic` \| `gemini` \| `openrouter` \| `ollama` \| `bedrock` \| `openai-compatible` |
| `model` | per-provider | Model name (required for `openai-compatible`) |
| `base-url` | — | OpenAI-compatible API base URL (for `openai-compatible`) |
| `api-key` | — | Provider key; mapped to the correct `*_API_KEY` var, or `LEDGER_API_KEY` for `openai-compatible` (pass a secret) |
| `audience` | `engineering` | `engineering` \| `business` \| `qa` |
| `output` | `markdown` | `markdown` \| `json` |
| `output-file` | — | Write notes to this file |
| `args` | — | Extra raw flags, e.g. `--since-last-tag --fail-on-empty` |
| `package` | `@anishhs/ledger` | npm spec to run (during beta pass `@anishhs/ledger@beta`; or pin a version, e.g. `@anishhs/ledger@1.0.0-beta.0`) |

Output: `file` — the path written (equals `output-file`).

Prefer raw `npx`? That works too:

```yaml
      - run: npx @anishhs/ledger@beta generate -o RELEASE_NOTES.md
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### GitLab CI

```yaml
release-notes:
  image: node:20
  rules:
    - if: $CI_COMMIT_TAG
  variables:
    GIT_DEPTH: "0"
  script:
    - npx --yes @anishhs/ledger@beta generate --provider openai -o RELEASE_NOTES.md
  artifacts:
    paths: [RELEASE_NOTES.md]
```

### Jenkins

```groovy
environment { OPENAI_API_KEY = credentials('openai-api-key') }
steps {
  sh 'npx --yes @anishhs/ledger@beta generate --provider openai -o RELEASE_NOTES.md'
}
```

### Any other runner

```bash
git fetch --tags --unshallow || true       # ensure history + tags
export OPENAI_API_KEY=...                   # or your provider's key
npx @anishhs/ledger@beta generate --since-last-tag -o RELEASE_NOTES.md
```

Copy-paste templates for each platform live in [`examples/`](./examples).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (also empty range, unless `--fail-on-empty`) |
| `1` | Runtime/provider error |
| `2` | Usage or configuration error (missing/unknown provider, bad ref, auth failure) |
| `3` | No changes found **and** `--fail-on-empty` was set |

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test          # vitest
npm run build     # tsup → dist/cli.js
```

## Contributing

Bug reports and focused PRs are welcome — `ledger` is in beta. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the dev setup and the gitflow branch/PR workflow.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## Author

**Anish Shekh**
&nbsp;·&nbsp; [Website](https://anishhs.com)
&nbsp;·&nbsp; [GitHub](https://github.com/anishhs-gh)
&nbsp;·&nbsp; [LinkedIn](https://linkedin.com/in/anishsh)

## License

MIT © [Anish Shekh](https://github.com/anishhs-gh)
