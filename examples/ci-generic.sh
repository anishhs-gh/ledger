#!/usr/bin/env bash
#
# Portable release-notes generation for any CI runner or local shell.
#
# Requirements:
#   - node (>=18) and git on PATH
#   - full git history with tags fetched (e.g. `git fetch --tags --unshallow` in CI)
#   - a provider API key exported in the environment
#   - a ledger.config.yaml committed to the repo (run `ledger init`) — sets provider & model
#
# Usage:
#   OPENAI_API_KEY=sk-... ./ci-generic.sh [output-file]
#
set -euo pipefail

: "${OPENAI_API_KEY:?Set your provider API key (e.g. OPENAI_API_KEY) before running}"

OUT="${1:-RELEASE_NOTES.md}"

# Provider and model are read from ledger.config.yaml.
npx --yes @anishhs/ledger generate \
  --since-last-tag \
  --output-file "$OUT"

echo "Release notes written to $OUT"
