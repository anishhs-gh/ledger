# CI examples

Drop-in recipes for running `ledger` in common CI systems. All of them just invoke
`npx @anishhs/ledger@beta generate`, so they work the same as running it locally — the tool
auto-detects the CI environment and derives the commit range when you don't pass one.

> **Beta:** the package is published under the npm `beta` dist-tag, so the snippets use
> `@anishhs/ledger@beta` (and the action is pinned to `anishhs-gh/ledger@v1.0.0-beta.0` with
> `package: '@anishhs/ledger@beta'`). Drop the `@beta`/pin once stable `1.0.0` ships.

| File | Platform | Notes |
| --- | --- | --- |
| [`../action.yml`](../action.yml) | GitHub Actions | Composite action — `uses: anishhs-gh/ledger@v1.0.0-beta.0` |
| [`github-actions.yml`](./github-actions.yml) | GitHub Actions | Full example workflow using the action |
| [`gitlab-ci.yml`](./gitlab-ci.yml) | GitLab CI | Tag-pipeline job |
| [`Jenkinsfile`](./Jenkinsfile) | Jenkins | Declarative pipeline in a Node container |
| [`ci-generic.sh`](./ci-generic.sh) | Any runner / local | Portable shell script |

## Two things every runner needs

1. **Full git history + tags.** CI systems often do shallow clones, which hides the tag
   history `ledger` needs to compute a range. Fetch everything:
   - GitHub Actions: `actions/checkout@v4` with `fetch-depth: 0`
   - GitLab CI: `GIT_DEPTH: "0"`
   - generic: `git fetch --tags --unshallow || true`

2. **A provider API key** in the environment (e.g. `OPENAI_API_KEY`), supplied from your
   CI's secret store.
