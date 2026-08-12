# Lottery Data → Pages Deployment Design

## Problem

The scheduled data workflow updates and pushes `data/lotto-data.json` and
`public/data/lotto-data.json` with the repository `GITHUB_TOKEN`. GitHub does
not start another workflow from that token-generated push, so the Pages deploy
workflow remains idle and the public site serves an older build.

## Approved approach

Keep data collection and Pages deployment as separate workflows. After the data
workflow creates and pushes a new commit, it ensures that
`.github/workflows/deploy.yml` has a healthy run for that exact commit and
branch (`master` for scheduled runs), dispatching it when needed. An ordinary
no-change run does not create another deployment, but it can recover a missing
or failed deployment for the current branch commit.

The update workflow will:

1. Detect whether the staged data files contain a change.
2. Expose a data-change step output.
3. Commit and push only when that output is `true`.
4. Serialize updates per branch and expose whether this run actually advanced
   the remote branch, including when a queued run rebases over identical data.
5. Reconcile the remote branch SHA with successful, queued, or in-progress
   non-PR deploy runs for that exact branch and commit.
6. If no healthy deploy run exists, dispatch the Pages workflow using GitHub's
   REST API and the repository `GITHUB_TOKEN`.

The workflow receives `actions: write` in addition to its existing
`contents: write` permission. The deployment workflow retains its existing
`workflow_dispatch`, push, and pull-request triggers.

## Failure behavior

- Crawl, commit, push, or dispatch failure makes the data workflow fail visibly.
- A no-change run stays successful; it dispatches only when the current remote
  commit has no healthy deployment and therefore needs recovery.
- A queued duplicate run that performs no remote push does not create a
  duplicate deployment when a healthy run already exists.
- If a data push succeeds but dispatch or deployment fails, a rerun or the next
  scheduled no-change run detects the missing healthy deployment and retries it.
- Deployment remains independently observable in the Actions page.
- Deployment reconciliation happens after the optional push and resolves the
  remote branch SHA, so the deploy checks out the current branch commit rather
  than the run's original checkout SHA.

## Validation

- Parse every workflow YAML file.
- Validate the modified workflow with `actionlint` when available.
- Run the project's production build.
- After publishing, run the update workflow and confirm a subsequent Pages
  deployment completes on current `master`.
- Confirm the live JSON's newest issue, record count, and SHA-256 match
  `master/public/data/lotto-data.json`.
