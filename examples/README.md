# CI examples

Drop-in recipes for running `ledger` in common CI systems. All of them just invoke
`npx @anishhs/ledger generate`, so they work the same as running it locally — the tool
auto-detects the CI environment and derives the commit range when you don't pass one.

Every recipe reads its provider and model from a **`ledger.config.yaml` committed to your repo**
(run `ledger init` to create one). That keeps the CI job free of ledger settings — it supplies
only the API key — so switching provider or model is a one-line edit to the committed file.

| File | Platform | Notes |
| --- | --- | --- |
| [`../action.yml`](../action.yml) | GitHub Actions | Composite action — `uses: anishhs-gh/ledger@v1` |
| [`github-actions.yml`](./github-actions.yml) | GitHub Actions | Full example workflow using the action |
| [`gitlab-ci.yml`](./gitlab-ci.yml) | GitLab CI | Tag-pipeline job |
| [`Jenkinsfile`](./Jenkinsfile) | Jenkins | Declarative pipeline in a Node container |
| [`ci-generic.sh`](./ci-generic.sh) | Any runner / local | Portable shell script |

## Three things every runner needs

1. **A committed `ledger.config.yaml`** (from `ledger init`) with at least a `provider:` — this
   is where provider/model/token settings live, so you don't repeat them in the pipeline.

2. **Full git history + tags.** CI systems often do shallow clones, which hides the tag
   history `ledger` needs to compute a range. Fetch everything:
   - GitHub Actions: `actions/checkout@v4` with `fetch-depth: 0`
   - GitLab CI: `GIT_DEPTH: "0"`
   - generic: `git fetch --tags --unshallow || true`

3. **A provider API key** in the environment (e.g. `OPENAI_API_KEY`), supplied from your
   CI's secret store. With the GitHub composite action, pass it as the `api-key` input — the
   action reads your config's `provider` to route it to the right variable.
