<p align="center">
  <img src="https://raw.githubusercontent.com/anishhs-gh/ledger/master/ledger.svg" alt="ledger" width="64" />
</p>

<h1 align="center">ledger</h1>

[![npm](https://img.shields.io/npm/v/@anishhs/ledger.svg)](https://www.npmjs.com/package/@anishhs/ledger)
[![CI](https://github.com/anishhs-gh/ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/anishhs-gh/ledger/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/@anishhs/ledger.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@anishhs/ledger.svg)](https://nodejs.org)

**AI-powered release notes, generated from your git history — locally or in any CI.**

`ledger` analyses your commits **and the actual code diffs**, reduces them into a focused
context, and asks the AI provider of your choice to write release notes tailored to a
specific audience (engineering, business, or QA). Bring your own API key; no vendor lock-in.

```bash
npx @anishhs/ledger generate --since-last-tag
```

> [!TIP]
> **~3.5 MB install — 16× smaller than the beta.** The public beta (`1.0.0-beta.1`) bundled a
> vendor SDK for every provider and weighed ~58 MB. Stable `1.0.0` is **SDK-free**: every provider
> talks to its API over plain `fetch`, dropping the install to ~3.5 MB. Since `ledger` is meant to
> be run with `npx`, that means far faster cold starts and much less bandwidth per run — which is
> why it's worth calling out.

---

## Why

Most changelog tools just reformat commit messages. `ledger` reads the diff too, so the
notes describe *what actually changed* — not just what someone typed in a commit subject.

- **Provider-agnostic (BYOK):** OpenAI, Anthropic, Gemini, OpenRouter, Ollama, Bedrock.
- **CI-first, local-friendly:** the same command works on your laptop and inside GitHub
  Actions, GitLab CI, Jenkins, or any runner — auto-detecting the environment and range.
- **Robust:** per-request timeouts, automatic retry with backoff (honouring a provider's
  `Retry-After` hint), and a documented exit-code contract so pipelines behave predictably.
- **Cheap to preview:** `--dry-run` assembles the context and estimates tokens without
  spending anything.

## How it works

For a commit range, `ledger`:

1. **Collects** the commits *and their actual code diffs* with `git`.
2. **Reduces** them into a focused context, capping per-file diff size (`maxDiffLines`) so large
   PRs stay within token budgets.
3. **Prompts** your chosen AI provider — one non-streaming request — to write notes for your
   chosen **audience** (engineering / business / QA).
4. **Writes** the result as Markdown (default) or JSON, to stdout or a file.

Nothing leaves your machine except that single prompt to the provider you configured
(bring your own key). `ledger` stores nothing and calls no other service.

## Install

**Requirements:** Node ≥ 20, `git` on `PATH`, and an API key for your chosen provider
(none for local Ollama).

No install needed — run it with `npx`:

```bash
npx @anishhs/ledger generate --since-last-tag
```

Or install globally:

```bash
npm install -g @anishhs/ledger
ledger generate --since-last-tag
```

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
| `--since-last-tag` | From the last git tag to `HEAD` (default when no range is given). On a **first release** — no tags yet, or the only tag is the one you just cut on `HEAD` — it covers the entire history instead, root commit included |
| `--from <ref>` | Start from a tag, branch, or SHA |
| `--to <ref>` | End ref (default: `HEAD`) |
| `--last <n>` | Include the last N commits (clamped to available history — asking for more than exist just includes everything back to the first commit) |

In CI, if you pass **no** range flag, `ledger` derives one automatically:
a tag build uses *previous tag → this tag*; a PR/MR build uses *base branch → HEAD*.
On the **first** tag build there is no previous tag, so the range covers the whole
history — the root commit and everything it introduced are included, not skipped.

### Output & behaviour

| Flag | Description |
| --- | --- |
| `--audience <mode>` | `engineering` (default), `business`, or `qa` |
| `--output <format>` | `markdown` (default) or `json` |
| `-o, --output-file <path>` | Write notes to a file. Optional — omit it and notes go to **stdout**. When set, notes are **not** echoed to stdout (add `--stdout` if you want both) |
| `--stdout` | Also echo the notes to stdout when writing to `--output-file` |
| `--append` | Append to `--output-file` instead of overwriting (newest at the bottom) |
| `--prepend` | Prepend to `--output-file` (newest on top, inserted below a leading `#` title) — ideal for a `CHANGELOG.md` |
| `--max-tokens <n>` | Max tokens for the AI response (default 4096) |
| `--timeout <ms>` | Per-request timeout (default 60000) |
| `--quiet` | Suppress progress on stderr (errors still shown) |
| `--dry-run` | Assemble context + estimate tokens, **without** calling the AI |
| `--fail-on-empty` | Exit non-zero when there are no changes in the range |
| `--no-summary` | Don't write to the CI step summary even when one is detected |
| `--provider <name>` / `--model <name>` | Override the configured provider/model |
| `--config <path>` | Path to a config file |

Without `--output-file`, notes are written to **stdout** and all progress/logging goes to
**stderr**, so `ledger generate > NOTES.md` is always clean. With `--output-file`, the file is
the output and stdout stays quiet unless you add `--stdout`.

### JSON output (for programmatic use)

`--output json` emits a structured object instead of Markdown — handy when another tool consumes
the notes (posting a PR comment, feeding a release dashboard, etc.). `content` holds the AI-written
body; the rest is metadata `ledger` computed:

```jsonc
{
  "title": "Release Notes",
  "date": "2026-07-07",
  "range": "v1.2.0..HEAD",
  "audience": "engineering",
  "commits": 12,
  "filesChanged": 34,
  "content": "# Release Notes\n\n## New Features\n...",   // the AI-generated markdown body
  "repo": "owner/repo",        // present in CI when detected
  "ref": "refs/tags/v1.3.0",   // present in CI when detected
  "runUrl": "https://..."      // present in CI when detected
}
```

```bash
# e.g. pull just the body out with jq
ledger generate --since-last-tag --output json | jq -r .content
```

## Configuration

Run `ledger init` to scaffold **`ledger.config.yaml`** — one small YAML file that holds all of
`ledger`'s settings (provider, model, token limits, …). **Commit it to your repo.** It's the single
source of truth used both on your laptop and in CI, so you never have to repeat provider/model flags
anywhere. Everything in it is optional except `provider`.

```yaml
provider: openai      # openai | anthropic | gemini | openrouter | ollama | bedrock | openai-compatible
model: gpt-4o         # optional — a sensible default is used per provider (required for openai-compatible)
# audience: engineering  # default audience when --audience isn't passed
# maxDiffLines: 100   # cap per-file diff lines sent to the AI (reduces tokens on big PRs)
# maxTokens: 4096     # max tokens for the AI's response (default 4096)
# timeout: 60000      # per-request timeout (ms)
# maxRetries: 3       # retry attempts on transient provider errors (429/5xx/network)
```

Only the **API key** stays out of the file — keep it in an environment variable (locally) or a
secret (in CI). See [Providers & keys](#providers--keys) for the variable each provider reads.

### Accepted config file names

`ledger` looks in the current directory for the **first** of these that exists (so `.yaml` wins over
`.yml` if you have both), or point at any path with `--config <path>`:

| File | Format |
| --- | --- |
| `ledger.config.yaml` | YAML _(what `ledger init` creates)_ |
| `ledger.config.yml` | YAML |
| `.ledger.yaml` | YAML (dotfile) |
| `.ledger.yml` | YAML (dotfile) |
| `ledger.config.json` | JSON |

`.yaml` and `.yml` are treated identically — pick whichever your repo prefers. A JSON config uses the
same keys:

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "maxTokens": 4096
}
```

```bash
# Or keep it anywhere and pass the path explicitly:
ledger generate --since-last-tag --config config/ledger.json
```

**Precedence (highest first):** `LEDGER_PROVIDER` / `LEDGER_MODEL` env vars → CLI flags →
config file → built-in defaults. So the committed file sets your defaults, and a flag lets you
override one run without editing it. (An **empty** env var — e.g. an unset `vars.LEDGER_MODEL` in
CI — is ignored, so it falls back to the config file rather than blanking the value.)

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
| Bedrock | `BEDROCK_API_KEY` *or* AWS IAM (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, …) | `AWS_REGION` defaults to `us-east-1`. Reasoning models (e.g. `openai.gpt-oss-*`) are supported. |
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

**The recommended setup: commit `ledger.config.yaml`, and let CI just run `ledger generate`.**
Because your provider and model live in that file (see [Configuration](#configuration)), the CI job
carries no ledger settings at all — it only supplies the API key as a secret. Switching providers or
models later is a one-line edit to the committed file, with nothing to change across your pipelines.
The snippets below assume a `ledger.config.yaml` is checked in.

### GitHub Actions (composite action)

> **The action is optional** — it's just a convenience wrapper around `npx @anishhs/ledger`. If you
> prefer not to depend on it, skip straight to the plain `npx` step [below](#prefer-raw-npx) — it
> does exactly the same thing. Everything `ledger` does (CI detection, range derivation, step
> summary) lives in the CLI, not the action.

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
      - uses: anishhs-gh/ledger@v1
        with:
          api-key: ${{ secrets.OPENAI_API_KEY }}   # the only secret; provider/model come from ledger.config.yaml
          output-file: RELEASE_NOTES.md
```

> Pin the action to the floating `anishhs-gh/ledger@v1` tag (or a specific release, e.g.
> `anishhs-gh/ledger@v1.1.0`) to control when you pick up updates.

**Action inputs** — all optional; anything you omit is read from the committed `ledger.config.yaml`.
Set them here only to override the file for this workflow:

| Input | Default | Description |
| --- | --- | --- |
| `api-key` | — | Provider key; mapped to the correct `*_API_KEY` var, or `LEDGER_API_KEY` for `openai-compatible` (pass a secret) |
| `provider` | from config | `openai` \| `anthropic` \| `gemini` \| `openrouter` \| `ollama` \| `bedrock` \| `openai-compatible` |
| `model` | from config | Model name |
| `base-url` | from config | OpenAI-compatible API base URL (for `openai-compatible`) |
| `audience` | `engineering` | `engineering` \| `business` \| `qa` |
| `output` | `markdown` | `markdown` \| `json` |
| `output-file` | — | Write notes to this file |
| `args` | — | Extra raw flags, e.g. `--since-last-tag --fail-on-empty` |
| `package` | `@anishhs/ledger` | npm spec to run (pin a version if you like, e.g. `@anishhs/ledger@1.1.0`) |

Output: `file` — the path written (equals `output-file`).

<a id="prefer-raw-npx"></a>
Prefer raw `npx` (no action dependency)? That works too — still just the key plus the committed config:

```yaml
      - run: npx @anishhs/ledger generate -o RELEASE_NOTES.md
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### Attach the notes to a GitHub Release

The most common end-to-end flow: on a version tag, generate the notes and publish them as the
release body. Generation is **best-effort** — if the AI call fails, fall back to GitHub's
auto-generated notes so a release is never blocked. (This is exactly what `ledger`'s own
[`publish.yml`](./.github/workflows/publish.yml) does.)

```yaml
name: Release
on:
  push:
    tags: ['v*']
permissions:
  contents: write   # required to create the release
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0                     # full history + tags

      - name: Generate notes (best-effort)
        id: notes
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}   # provider/model from ledger.config.yaml
        run: |
          set -uo pipefail
          file="$RUNNER_TEMP/NOTES.md"
          if npx --yes @anishhs/ledger generate --since-last-tag -o "$file" --quiet && [ -s "$file" ]; then
            echo "file=$file" >> "$GITHUB_OUTPUT"
          else
            echo "::warning::ledger failed — falling back to GitHub auto-generated notes."
          fi

      - name: Create the release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ -n "${{ steps.notes.outputs.file }}" ]; then
            gh release create "${{ github.ref_name }}" --notes-file "${{ steps.notes.outputs.file }}"
          else
            gh release create "${{ github.ref_name }}" --generate-notes
          fi
```

The two keys to the fallback: `set -uo pipefail` (**not** `-e`) so a failed generation doesn't
abort the step, and the `&& [ -s "$file" ]` check so an *empty* file also triggers the fallback.

### GitLab CI

```yaml
release-notes:
  image: node:20
  rules:
    - if: $CI_COMMIT_TAG
  variables:
    GIT_DEPTH: "0"   # full history + tags
  script:
    - npx --yes @anishhs/ledger generate -o RELEASE_NOTES.md   # provider/model from ledger.config.yaml
  artifacts:
    paths: [RELEASE_NOTES.md]
```

Set `OPENAI_API_KEY` (or your provider's key) as a masked CI/CD variable.

### Jenkins

```groovy
environment { OPENAI_API_KEY = credentials('openai-api-key') }
steps {
  sh 'npx --yes @anishhs/ledger generate -o RELEASE_NOTES.md'   // provider/model from ledger.config.yaml
}
```

### Any other runner

```bash
git fetch --tags --unshallow || true       # ensure history + tags
export OPENAI_API_KEY=...                   # or your provider's key
npx @anishhs/ledger generate --since-last-tag -o RELEASE_NOTES.md   # config from ledger.config.yaml
```

Copy-paste templates for each platform live in [`examples/`](./examples) — each reads its
settings from a committed `ledger.config.yaml`.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success (also empty range, unless `--fail-on-empty`) |
| `1` | Runtime/provider error |
| `2` | Usage or configuration error (missing/unknown provider, bad ref, auth failure) |
| `3` | No changes found **and** `--fail-on-empty` was set |

## Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| **Empty notes / "no changes"**, or a git "unknown revision" error on `--from` / `--since-last-tag` | CI did a **shallow clone**, so tags and history aren't present. Fetch them: `actions/checkout@v4` with `fetch-depth: 0`, GitLab `GIT_DEPTH: "0"`, or `git fetch --tags --unshallow`. |
| **`Authentication failed …` (exit 2)** | The provider's key env var isn't set, or is wrong for the selected provider. Check the [Providers & keys](#providers--keys) table — e.g. `anthropic` reads `ANTHROPIC_API_KEY`, not `OPENAI_API_KEY`. |
| **`Rate limited … (exit 1)`** | `ledger` already retries with backoff and honours the provider's `Retry-After`. If it still exhausts, lower run frequency, raise `maxRetries`, or switch to a higher-tier key. |
| **Notes look truncated / empty response** | The model hit the token cap — raise `--max-tokens` (models with reasoning on by default, like Claude Sonnet 5, spend part of the budget thinking). |
| **`Request too large` / HTTP 413** | The prompt **plus the reserved `--max-tokens` output** exceeded the provider's per-request or per-minute token limit — common on free tiers (e.g. Groq's 12k tokens/minute). Narrow the range, lower `--max-tokens`, set a smaller `maxDiffLines`, or use a higher-tier key / larger-limit provider. Run `--dry-run` first — it now prints the **total** tokens requested (prompt + reserved output). |
| **`openai-compatible` errors about a missing baseURL/model** | That provider needs both a `baseURL` and a `model` — set them in `ledger.config.yaml`, via `LEDGER_BASE_URL` / `--base-url`, or `--model`. |
| **Model-not-found (404 / invalid model)** | The `model` string must be exactly what your provider expects (e.g. Bedrock model IDs like `openai.gpt-oss-20b-1:0`). Check the provider's model list. |

Tip: run with `--dry-run` first — it assembles the context and prints the token estimate without
calling the AI (and without spending anything), so you can confirm the range and size are right.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test          # vitest
npm run build     # tsup → dist/cli.js
```

## Contributing

Bug reports and focused PRs are welcome. See
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
