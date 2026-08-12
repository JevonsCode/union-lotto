# Adjacent Transition Analysis Implementation Plan

## Objective

Replace the incorrect sequence statistics with tested pure algorithms, expose
50/100/custom training windows and leakage-free rolling backtests, apply one
complete-history collision contract to every generated set, and deploy the
verified result to GitHub Pages.

## Task 1: Test harness and collision service

Files:

- Modify `package.json`
- Create `src/utils/historicalCollision.js`
- Create `test/historicalCollision.test.js`

Steps:

1. Add `node --test` as the project test command.
2. Write fixtures for draw-order normalization, duplicate red sets, distinct
   blue balls, invalid history rows, invalid generated values, and no matches.
3. Implement a reusable collision index and result contract.
4. Verify red-only and full-combination matches return every issue/date row.

## Task 2: Transition model core

Files:

- Create `src/utils/transitionAnalysis.js`
- Create `test/transitionAnalysis.test.js`

Steps:

1. Test canonical chronology and invalid-record metadata.
2. Test immediate first-order edges and source-specific denominators.
3. Test recent half-life weights, second-order minimum-sample backoff, evidence,
   used-candidate renormalization, and global fallback.
4. Implement deterministic greedy generation and beam search.
5. Test selected-start recalculation, uniqueness, tie-breaking, and window
   boundaries.

## Task 3: Rolling backtest

Files:

- Extend `src/utils/transitionAnalysis.js`
- Extend `test/transitionAnalysis.test.js`

Steps:

1. Add look-ahead-leakage fixtures before implementation.
2. Implement active-model evaluation for common target horizons and trailing
   50/100/custom training windows.
3. Implement deterministic first-position start selection and generated-set
   match distributions.
4. Attach collision metadata to generated target rows.
5. Verify requested/effective/skipped counts, uniform baselines, best target
   details, and exact-six counts.

## Task 4: Store integration

Files:

- Modify `src/stores/lottoStore.js`

Steps:

1. Add an explicit active-filter state and transition data selector.
2. Replace duplicated sequence helpers with pure-module calls.
3. Preserve random starts for existing sequence-generator callers and allow an
   explicit start for the analysis UI.
4. Build the collision index from complete loaded history and attach collision
   results to random, frequency, and sequence predictions.
5. Attach collision results to position-analysis predictions.

## Task 5: Shared collision UI

Files:

- Create `src/components/HistoricalCollisionStatus.vue`
- Modify `src/components/PredictionGenerator.vue`
- Modify `src/components/PositionAnalysis.vue`

Steps:

1. Render neutral, red-only, and full-combination states.
2. Add expandable issue/date/sorted-red/blue/draw-order details.
3. Reuse the component in prediction history and position-analysis rows.
4. Ensure compact responsive presentation.

## Task 6: Sequence analysis UI

Files:

- Replace `src/components/SequenceAnalysis.vue`

Steps:

1. Add start-number, model, training-window, and target-horizon controls.
2. Show correctly ranked next-number distributions and evidence records.
3. Show greedy draw order, sorted set, step explanations, and collision status.
4. Show the top three beam alternatives and collision status.
5. Run explicit backtests and compare 50/100 windows for the active model.
6. Display Top1/3/5 metrics, baselines, 0–6 matches, best rows, exact-six count,
   collision details, and independence caveat.

## Task 7: CI, verification, and deployment

Files:

- Modify `.github/workflows/deploy.yml`

Steps:

1. Run `pnpm test` before production build in Pages CI.
2. Run local unit tests, YAML/actionlint validation, production build, and
   current-data acceptance checks (`05`: total 521, `32`: 25 / 4.80%).
3. Run a local browser smoke test at desktop and narrow viewport.
4. Independently review algorithm, UI, and workflow changes; resolve findings.
5. Commit only intended files and push `master`.
6. Watch the Pages run to success.
7. Verify both production URLs, cache-busted assets, current JSON, new controls,
   collision status, and backtest results.
