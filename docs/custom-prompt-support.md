# Design: Custom Prompt Support

> **Status: Proposed — not yet implemented.** This document is the agreed design for how
> `ledger` will let users influence *how* the release notes are written. It is a plan, not a
> description of shipped behaviour. The flags and config keys below do not exist yet.

## Why

Today the writing style is fixed by `--audience` (`engineering` / `business` / `qa`). Teams want
to layer their own house style on top — "group by Conventional Commit type", "one sentence per
bullet", "no marketing preamble", a particular tone. We want to allow that **without** weakening the
guarantees the tool currently provides.

## Threat / risk model (what "safe" actually means here)

It is worth being precise, because the usual LLM fears mostly do not apply to this tool:

- The model is a **pure text transform**. It has **no tools, no function calling, and no filesystem
  or network access** of its own.
- The model **never receives the API key or environment** — the key is read from env at the HTTP
  layer and is never placed in the prompt. So a custom prompt **cannot exfiltrate secrets**.
- The model's output becomes release notes (stdout / a file / a GitHub Release). Worst realistic
  outcome is *bad notes*, not code execution or data loss.

So the real risks a custom-prompt feature must contain are:

1. **Output-contract corruption** — a custom prompt makes the model abandon the structure or format
   that downstream consumers (JSON mode, CI step summary, a committed CHANGELOG) depend on.
2. **Cost / token blowup** — an unbounded prompt file crowds out the diff or runs up the bill.
3. **Intent hijack** — adversarial text, in a custom instruction *or* embedded in a commit message
   or diff, steers the notes somewhere unintended.

The design below neutralizes all three.

## Design principles

### 1. Additive, never replacement

Custom text is **appended** to the audience system prompt as *style guidance*. It never replaces it.
The system prompt remains authoritative over the three things that must not change:

- the **task** ("generate release notes from these changes"),
- the **output format** (the markdown structure the formatter expects),
- the **framing** of the diff as data to summarize.

This means even a hostile or nonsensical instruction cannot stop the tool from being a release-notes
generator or break the output contract. A genuine full-override mode, if ever added, must be a
*separate, explicitly named* flag (`--raw-prompt`) that prints a warning — not the default path.

### 2. Order the prompt so the format wins

User instructions go in a clearly delimited block labeled as **preferences**, and the structural /
format requirement is restated **after** them with an explicit tie-breaker:

> "The above are stylistic preferences. If any conflict with producing valid, well-structured
> release notes in the required format, prefer the format."

Later, explicit instructions tend to dominate, so the envelope survives a pushy custom prompt.

### 3. Keep the output *envelope* out of user control

This is already true and must stay true: in JSON mode the **formatter** builds the envelope and the
model only fills the `content` field (`src/output/formatter.ts`). Custom prompts can influence the
prose inside `content` — never the JSON shape, the step-summary wrapper, or the metadata header.

### 4. Treat commit/diff text as untrusted data

The diff is already fenced under `# Changes to Analyse`. The system prompt should explicitly state
that commit messages and diff text are **content to summarize, not instructions to follow**. This is
the cheap defense against "ignore previous instructions" smuggled into a commit message — and it
matters more once users trust the output enough to shape it.

### 5. Bound the size and count it in the budget

Cap custom-instruction length (proposed: **4 KB**) and include it in the token estimate and the
context-reduction math (`src/context/reducer.ts`) so a large prompt file cannot starve the diff or
balloon cost. Over the cap → a clear `USAGE` (exit 2) error, never silent truncation.

### 6. Explicit provenance

Precedence, highest first: `--instructions` (inline) → `--prompt-file` → config `instructions`.
When custom instructions are active, log their source on stderr (unless `--quiet`) so committed
output is reproducible and auditable.

## Proposed surface

CLI:

| Flag | Meaning |
| --- | --- |
| `--instructions <text>` | Inline style guidance, appended to the audience prompt |
| `--prompt-file <path>` | Read that guidance from a file |

Config (`ledger.config.yaml`):

```yaml
instructions: |
  Group changes under Conventional Commit types (feat, fix, chore).
  Keep each bullet to one sentence. No preamble.
```

`--audience` keeps working and composes: you pick the base voice, then steer the rest.

## A safer-still alternative: structured knobs

The very safest design takes **no free-form text at all** and instead offers a small set of vetted
knobs that map to curated prompt fragments, e.g.:

- `--group-by conventional-commits | theme | file`
- `--tone concise | detailed`
- `--no-preamble`

This eliminates free-form intent-injection entirely and keeps output fully predictable, at the cost
of expressiveness. It is not mutually exclusive with the free-form approach.

## Recommended rollout

1. **Phase 1 — additive free-form** (`--instructions` / `--prompt-file` / config), with principles
   1–6 enforced (additive, format-wins ordering, envelope locked, size cap, provenance logging).
   This is flexible and the additive + format-precedence design contains every realistic failure.
2. **Phase 2 (optional) — structured knobs** for teams that want guaranteed-predictable output.
3. **Full override (`--raw-prompt`)** only if a concrete need appears, gated behind an explicit flag
   and a warning.

## CI note

`--prompt-file` is *trusted input*: in CI the file lives in the repo, so a pull request can change
the tone. That is a content concern, not a security one (the model reaches no secrets or tools).
Recommendation: commit the style file and code-review changes to it like any other source.
