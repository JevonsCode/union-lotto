# Lottery Data → Pages Deployment Design

## Problem

The scheduled data workflow updates and pushes `data/lotto-data.json` and
`public/data/lotto-data.json` with the repository `GITHUB_TOKEN`. GitHub does
not start another workflow from that token-generated push, so the Pages deploy
workflow remains idle and the public site serves an older build.

## Approved approach

Keep data collection and Pages deployment as separate workflows. When the data
workflow creates and pushes a new commit, it explicitly dispatches
`.github/workflows/deploy.yml` on `master`. No dispatch occurs when the crawler
finds no new draw.

The update workflow will:

1. Detect whether the staged data files contain a change.
2. Expose a `data_changed` step output.
3. Commit and push only when that output is `true`.
4. After the push succeeds, dispatch the Pages workflow using GitHub's REST API
   and the repository `GITHUB_TOKEN`.

The workflow receives `actions: write` in addition to its existing
`contents: write` permission. The deployment workflow retains its existing
`workflow_dispatch`, push, and pull-request triggers.

## Failure behavior

- Crawl, commit, push, or dispatch failure makes the data workflow fail visibly.
- A no-change run stays successful and does not deploy.
- Deployment remains independently observable in the Actions page.
- The dispatch happens only after `git push`, so the deploy checks out the new
  `master` commit rather than the run's original checkout SHA.

## Validation

- Parse every workflow YAML file.
- Validate the modified workflow with `actionlint` when available.
- Run the project's production build.
- After publishing, run the update workflow and confirm a subsequent Pages
  deployment completes on current `master`.
- Confirm the live JSON's newest issue, record count, and SHA-256 match
  `master/public/data/lotto-data.json`.

