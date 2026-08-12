# Historical Adjacent-Number Transition Analysis Design

## Goal

Correct the current sequence-probability calculation and turn it into an
interactive, explainable analysis tool. A user selects any red ball from 1 to
33, sees which number immediately followed it in historical draw order, and can
generate complete six-number chains by repeatedly applying the selected model.

This feature is descriptive statistical analysis. Lottery draws are independent;
the UI must not describe historical transition frequency as a future winning
probability.

## Existing defects

The current implementation has two material errors:

1. `SequenceAnalysis.vue` divides a transition count by every draw in the data
   set. The correct first-order conditional probability is
   `count(current → next) / count(current has an immediate successor)`.
2. The store gathers every number after the selected first ball, then reuses
   that single ranking for all five remaining choices. It neither limits the
   statistic to the immediate neighbor nor recalculates after each new number,
   so it cannot produce a true chain such as `05 → 32 → 18`.

## Scope

### Included

- Red-ball draw-order sequences from `seqFrontWinningNum`.
- Correct first-order adjacent transition probabilities.
- A recent-draw weighted model.
- A second-order model with explicit first-order backoff.
- Greedy generation and beam-search alternatives from a user-selected start.
- Historical evidence for each transition.
- Leakage-free rolling historical backtesting.
- A selectable recent-history training window, including 50, 100, and custom
  draw counts.
- A shared historical-collision service used by every generated number set.
- Integration with the existing sequence prediction rule.
- Responsive desktop and mobile presentation.

### Excluded

- Blue-ball transitions, because each draw contains only one blue ball.
- Machine-learning claims or claims that a model predicts an independent draw.
- Server-side storage or a new API; all calculations use the JSON already
  loaded by the application.
- A new blue-ball transition model. The adjacent-transition panel evaluates red
  balls only; existing generators that already produce a blue ball still
  receive full-combination collision checks.

## Data preparation

Create a pure JavaScript module at `src/utils/transitionAnalysis.js`. It accepts
raw draw records and normalizes only records whose `seqFrontWinningNum` contains
exactly six unique integers in the range 1–33. Invalid records are skipped and
reported in model metadata.

Each normalized draw has:

```js
{
  issue: '2026092',
  openTime: '2026-08-11',
  sequence: [5, 32, 18, 7, 20, 11]
}
```

Chronology is canonical and independent of input-array order. `issue` must be a
non-empty, unique, integer-like value and `openTime` must parse as a valid
calendar date. Records missing either field, containing a duplicate issue, or
containing an invalid date are skipped and counted by reason. Valid records are
ordered oldest to newest by parsed `openTime`, then numeric issue ascending;
recency order is the exact reverse. The current data set has unique issues and
valid dates, but these rules make later updates deterministic and prevent an
invalid chronology from entering a backtest.

Calculations retain full floating-point precision. Counts and percentages are
rounded only when rendered.

## Statistical models

### First-order adjacent model

For every valid sequence, record only the five immediate edges:

```text
n1 → n2, n2 → n3, n3 → n4, n4 → n5, n5 → n6
```

For a source number `a`:

```text
P(b | a) = count(a → b) / Σx count(a → x)
```

The denominator is therefore the number of historical sequences in which `a`
has an immediate successor, not the total number of draws. Candidate ordering
is deterministic: probability descending, raw count descending, then number
ascending. The model retains the issue, date, and complete sequence for every
observed edge so the UI can expose supporting records.

### Recent-weighted model

The newest draw has rank zero. A draw at recency rank `r` receives:

```text
weight(r) = 0.5 ** (r / 365)
```

This gives historical evidence a 365-draw half-life. Weighted conditional
probabilities use weighted edge counts divided by total outgoing weight. The UI
still shows raw counts alongside weighted percentages so the result remains
auditable. The half-life is a named constant and is not exposed as a user
setting in the first version.

### Second-order model

For every consecutive triple, collect `(a, b) → c`. After the first generated
step, the model can estimate:

```text
P(c | a, b) = count(a, b → c) / Σx count(a, b → x)
```

A second-order context is used only when it has at least eight historical
samples. Otherwise it explicitly backs off to the first-order distribution for
the current number `b`. Each generated step records whether it used second
order, first-order backoff, or a final global-frequency fallback. Evidence for a
second-order candidate contains only records that match the complete
`(a, b) → c` context.

### Fallback

Candidates already present in the partial six-number chain are removed. If the
selected distribution has no unused candidate, rank the remaining numbers by
their unconditional red-ball occurrence count, then number ascending. The
fallback distribution assigns each remaining number its unconditional count
divided by the sum of unconditional counts among the remaining numbers. If all
such counts are zero, it uses a uniform distribution over the remaining
numbers. This guarantees six unique numbers while visibly labeling the
fallback.

Whenever used numbers are removed from an observed or fallback distribution,
the remaining candidate probabilities are renormalized to sum to one. The UI
shows both the original historical conditional probability and the path-choice
probability after exclusion; beam scoring uses only the latter. This prevents a
path from being rewarded or penalized merely because more of its candidates
were already used.

## Chain generation

The user chooses a start number and a model. Two generation methods are shown:

1. **Greedy chain:** at each step, choose the highest-ranked unused candidate
   from the newly calculated distribution for the current path.
2. **Beam search:** retain the best eight partial paths at each step, expand each
   with its eight strongest unused candidates, score a path by the sum of log
path-choice probabilities, and return the top three distinct complete chains.
Fallback steps use the defined fallback probability and are included in the
same scoring rule. Ties are resolved by the complete draw-order chain compared
lexicographically by numeric value, making results deterministic.

The UI preserves the generated draw-order chain for explanation and also shows
a separately sorted copy suitable for reading as a conventional red-ball set.
No generated blue ball is part of this analysis panel.

## Training window

Every interactive transition model receives a `trainingWindow` option. The UI
offers All history, Latest 50, Latest 100, and Custom. Custom accepts an integer
from 20 through the number of valid records in the active issue range. For an
interactive model, “latest” means the newest valid records within the active
range after canonical chronology sorting. The model metadata exposes both the
requested and effective record counts.

For historical evaluation, the same number is a trailing rolling window. When
scoring target draw `t`, training contains at most the `N` valid draws
immediately preceding `t`; it never contains `t` or a later draw. If fewer than
20 earlier draws exist, that target is not evaluated. The 50-window and
100-window results are calculated independently from identical target periods
so they can be compared fairly.

## Unified historical collision detection

Create a pure shared module at `src/utils/historicalCollision.js`. Every
generated result—random, frequency, corrected sequence, position analysis,
greedy chain, and beam-search alternative—is passed through the same service
before it reaches a component.

Red-ball keys sort and normalize six unique values to two-digit strings, so a
generated draw-order chain matches the conventional sorted historical result.
When a generated result also contains a blue ball, the service additionally
checks the normalized red-ball key plus normalized blue ball.

```js
checkHistoricalCollision(history, {
  redBalls: [33, 2, 21, 3, 22, 15],
  blueBall: 6 // optional
})
```

It returns:

```js
{
  redBallCollision: true,
  redBallMatches: [
    {
      issue: '2025070',
      openTime: '2025-06-22',
      redBalls: [2, 3, 15, 21, 22, 33],
      blueBall: 6,
      drawOrder: [/* historical order when available */]
    }
  ],
  fullCombinationCollision: false,
  fullCombinationMatches: []
}
```

All matching historical rows are returned, not only the newest match. The
collision index is built from the complete loaded history, deliberately not the
active analysis filter: “has this ever occurred?” always means the entire
available historical data set. Invalid generated values throw a descriptive
error; invalid history rows are skipped and counted in collision metadata.

The result card always shows a neutral “未与历史红球组合碰撞” state when no
red-ball match exists. A collision shows a prominent warning, the number of
matching draws, and an expandable list containing issue, date, sorted red balls,
blue ball, and historical draw order. Results that include a blue ball show
separate red-only and full-combination statuses. This avoids treating a repeat
of six red balls with a different blue ball as an exact seven-number repeat.

## Historical backtest

Backtesting uses rolling-origin evaluation to prevent future-data leakage:

1. Sort valid records from oldest to newest.
2. Choose an evaluation horizon (Latest 50 targets, Latest 100 targets, or a
   valid custom count) and one or more training windows.
3. Require at least 20 earlier draws; for each target, select only the trailing
   `trainingWindow` earlier records.
4. Before scoring a target draw, build the model using only that trailing
   training slice.
5. For each of the target draw's five actual adjacent decisions, pass only the
   preceding actual numbers as context and remove numbers already seen in that
   target sequence.
6. Record whether the actual next number appears in the model's Top 1, Top 3,
   or Top 5 candidates.
7. Independently generate one deterministic greedy six-red-ball set for that
   target. To avoid using any part of the target draw, its starting number is
   the highest-frequency valid first-position number in the training slice,
   ties resolved by number ascending.
8. Compare that generated set with the target draw's six red balls and record
   an exact red-ball hit count from 0 through 6.

The recent-weighted backtest calculates recency ranks inside each trailing
training slice. Results report the number of evaluated targets and transitions,
Top 1/3/5 transition hit rates, and the corresponding
uniform-choice baseline for the number of candidates available at each step.
For Top K, each evaluated decision contributes
`min(K, availableCandidateCount) / availableCandidateCount`; the displayed
baseline is the arithmetic mean across all evaluated decisions. This evaluates
historical ranking behavior, not future lottery predictability.

Generated-set results report the distribution of red-ball matches (0–6), mean
matches, best match count, the number of six-red-ball exact matches, and every
target draw tied for the best result with target issue/date, generated draw
order, sorted generated set, actual sorted set, and overlapping numbers. “中过
一次” in this panel means an exact six-red-ball match; official双色球 prize
tiers are intentionally not claimed because this model does not generate a
blue ball.

## Module interface

The pure module exposes focused functions:

```js
normalizeDrawSequences(records)
buildTransitionModel(records, options)
getNextNumberDistribution(model, path, options)
generateGreedyChain(model, startNumber, options)
generateBeamChains(model, startNumber, options)
backtestTransitionModel(records, options)
```

The Pinia store exposes `hasActiveFilter` separately from `filteredData`. The
analysis data source is `filteredData` whenever a filter is active, including
when that array is empty; it uses the full `data` array only when no filter is
active. This replaces the current ambiguous `filteredData.length > 0` fallback
for transition analysis and sequence generation, so an empty filter result
cannot silently analyze all history.

The store delegates sequence generation to the pure module. The old duplicated
sequence-analysis helpers are removed. The existing
`generatePrediction('sequence')` path uses the corrected first-order model; it
may accept an optional selected start number, while retaining a random start for
existing callers that do not provide one. Existing unrelated charts retain
their current data-source behavior unless explicitly routed through the new
transition-data selector.

## User interface

Replace the current `SequenceAnalysis.vue` implementation with an analysis panel
that contains:

- A 1–33 start-number picker.
- Model tabs: classic adjacent, recent weighted, and second order.
- Training-window controls: all, 50, 100, and custom draw count.
- The active range, valid-record count, skipped-record count, and outgoing
  sample size for the selected number.
- A ranked next-number view with raw count, correct conditional percentage, and
  a proportional bar. All observed candidates remain available; the first ten
  are shown initially.
- An evidence drawer for a candidate, listing matching issue/date/sequence rows
  and highlighting the selected adjacent pair.
- A greedy six-number chain with per-step explanations.
- Three beam-search alternatives with path scores.
- A backtest section containing Top 1/3/5 rates, baseline rates, evaluated sample
  size, 0–6 generated-set match distribution, best matching target details,
  exact-six count, 50-versus-100 window comparison, and the independence
  disclaimer.
- Shared historical-collision status and matching-draw details on every greedy
  or beam result; the existing prediction generator displays the same component
  for random, frequency, and sequence results.

The panel reacts to the application's existing issue-range filter. Changing the
range rebuilds the model and clears results that no longer match that range.
Empty or insufficient data produces an explanatory empty state instead of zero
percentages that could be mistaken for measured probabilities.

## Error handling and performance

- Model functions never mutate input records.
- Invalid sequences are counted and skipped rather than failing the page.
- Start numbers must be integers from 1–33; invalid programmatic calls throw a
  descriptive error.
- A model is built once per active data range and selected mode, not once per
  rendered number.
- Collision indexes are built once from the complete history and reused across
  generation modes.
- The full data set is small (about 3,500 draws and 17,500 first-order edges),
  so calculations remain client-side. Backtesting runs on explicit user action
  and displays a loading state.
- Errors are shown in the component with an alert and logged with their cause.

## Testing

Add Node's built-in test runner and pure-module tests covering:

- Sequence validation and non-mutation.
- Immediate-neighbor counting (numbers farther to the right must not count).
- The source-specific denominator and exact conditional probabilities.
- Historical evidence references.
- Recent weighting and deterministic tie-breaking.
- Second-order selection, minimum-sample backoff, and global fallback.
- Renormalization after used-number exclusion and exact fallback probabilities.
- Greedy recalculation after every selected number and six-number uniqueness.
- Beam-search result count, uniqueness, and deterministic ordering.
- Rolling backtest chronology, including a fixture that would pass only if a
  future record leaked into training.
- Unsorted input, duplicate/missing/invalid chronology handling, exact uniform
  baseline aggregation, and an empty active filter that must remain empty.
- Latest-50/latest-100/custom interactive windows and trailing rolling-window
  boundaries during backtesting.
- Generated-set overlap counts, deterministic backtest starts, best-target
  details, and exact-six counting.
- Red-only collision normalization across draw order, optional blue-ball exact
  collision, multiple historical matches, complete-history scope, invalid
  values, and no-match results.

Run unit tests, the production build, and a responsive browser smoke test. The
smoke test must verify start-number selection, model switching, evidence
expansion, chain generation, backtest output, and the existing data filter.

## Acceptance criteria

- For number 05 on the current full data set, the UI reports 521 outgoing
  adjacent observations; 05 → 32 reports 25 observations and 4.80%.
- Every displayed first-order candidate percentage uses its source number's
  outgoing total and the candidate percentages sum to approximately 100%.
- A generated chain recalculates from each newly selected number and contains
  six unique red balls.
- Every transition explanation identifies its model, sample count, probability,
  and any backoff/fallback.
- Evidence rows reproduce the source JSON's issue/date/draw-order sequence.
- Backtest results are produced without using the target or later records for
  training.
- 50- and 100-draw training-window backtests use the same target horizon and
  publish comparable red-ball match distributions and best matching issues.
- Changing the interactive training window rebuilds every displayed transition,
  chain, and sample-size label from exactly that recent slice.
- Every generated six-red-ball set displays whether it has ever appeared in the
  complete history and lists all matching issue/date records; generators with a
  blue ball also distinguish complete seven-number collisions.
- Existing random and frequency prediction modes continue to work.
- The page builds without errors and remains usable on narrow screens.

## Deployment

After unit, build, and browser verification pass, publish the commits to
`master`. Monitor the repository's GitHub Pages workflow to successful
completion, then verify the custom-domain page loads the new transition panel,
the live data remains current, and a cache-busted production asset contains the
new training-window, collision, and backtest UI.
