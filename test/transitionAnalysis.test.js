import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  RECENT_HALF_LIFE_DRAWS,
  normalizeDrawSequences,
  buildTransitionModel,
  getNextNumberDistribution,
  generateGreedyChain,
  generateBeamChains,
  backtestTransitionModel
} from '../src/utils/transitionAnalysis.js'

function draw(issue, sequence, openTime = `2026-01-${String(Number(issue) % 28 + 1).padStart(2, '0')}`) {
  return { issue: String(issue), openTime, seqFrontWinningNum: sequence.join(' ') }
}

function chronologicalDraws(count, sequenceFactory) {
  return Array.from({ length: count }, (_, index) => draw(
    1000 + index,
    sequenceFactory(index),
    `2025-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`
  ))
}

test('normalizes canonical chronology, reports invalid reasons, and does not mutate input', () => {
  const input = [
    draw('3', [1, 2, 3, 4, 5, 6], '2026-01-02'),
    draw('2', [1, 2, 3, 4, 5, 6], '2026-01-01'),
    draw('1', [1, 2, 3, 4, 5, 6], '2026-01-01'),
    { issue: '', openTime: '2026-01-03', seqFrontWinningNum: '1 2 3 4 5 6' },
    { issue: 'x', openTime: '2026-01-03', seqFrontWinningNum: '1 2 3 4 5 6' },
    draw('1', [7, 8, 9, 10, 11, 12], '2026-01-03'),
    { issue: '4', openTime: '', seqFrontWinningNum: '1 2 3 4 5 6' },
    draw('5', [1, 2, 3, 4, 5, 6], '2026-02-30'),
    draw('6', [1, 1, 3, 4, 5, 6], '2026-01-04')
  ]
  const snapshot = structuredClone(input)
  const result = normalizeDrawSequences(input)

  assert.deepEqual(input, snapshot)
  assert.deepEqual(result.records.map(record => record.issue), ['1', '2', '3'])
  assert.deepEqual(result.metadata, {
    inputRecordCount: 9,
    validRecordCount: 3,
    skippedRecordCount: 6,
    skippedByReason: {
      missingIssue: 1,
      invalidIssue: 1,
      duplicateIssue: 1,
      missingOpenTime: 1,
      invalidOpenTime: 1,
      invalidSequence: 1
    }
  })
})

test('duplicate issue handling is deterministic and invalid duplicates cannot hide valid rows', () => {
  const invalidFirst = [
    draw('10', [1, 1, 3, 4, 5, 6], '2026-01-01'),
    draw('10', [1, 2, 3, 4, 5, 6], '2026-01-02')
  ]
  const conflicting = [
    draw('11', [8, 7, 6, 5, 4, 3], '2026-01-03'),
    draw('11', [1, 2, 3, 4, 5, 6], '2026-01-04')
  ]

  const validResult = normalizeDrawSequences(invalidFirst)
  assert.deepEqual(validResult.records.map(record => record.sequence), [[1, 2, 3, 4, 5, 6]])
  assert.equal(validResult.metadata.skippedByReason.invalidSequence, 1)
  assert.equal(validResult.metadata.skippedByReason.duplicateIssue, 0)

  const forward = normalizeDrawSequences(conflicting)
  const reversed = normalizeDrawSequences([...conflicting].reverse())
  assert.deepEqual(forward, reversed)
  assert.deepEqual(forward.records[0].sequence, [8, 7, 6, 5, 4, 3])
  assert.equal(forward.metadata.skippedByReason.duplicateIssue, 1)

  const formattedIssues = [
    draw('1', [1, 2, 3, 4, 5, 6], '2026-01-05'),
    draw('01', [1, 2, 3, 4, 5, 6], '2026-01-05')
  ]
  assert.deepEqual(
    normalizeDrawSequences(formattedIssues),
    normalizeDrawSequences([...formattedIssues].reverse())
  )
})

test('first-order model counts only immediate neighbors with source-specific denominators and evidence', () => {
  const records = [
    draw(1, [1, 2, 9, 3, 4, 5], '2026-01-01'),
    draw(2, [6, 1, 3, 8, 7, 9], '2026-01-02'),
    draw(3, [1, 2, 7, 8, 9, 10], '2026-01-03')
  ]
  const model = buildTransitionModel(records, { mode: 'classic' })
  const distribution = getNextNumberDistribution(model, [1])

  assert.equal(model.metadata.trainingRecordCount, 3)
  assert.equal(model.firstOrder.get(1).total, 3)
  assert.deepEqual(distribution.candidates.map(candidate => [candidate.number, candidate.count]), [[2, 2], [3, 1]])
  assert.equal(distribution.candidates[0].historicalProbability, 2 / 3)
  assert.equal(distribution.candidates[1].historicalProbability, 1 / 3)
  assert.equal(distribution.candidates.some(candidate => candidate.number === 9), false)
  assert.deepEqual(distribution.candidates[0].evidence.map(row => row.issue), ['1', '3'])
  assert.deepEqual(distribution.candidates[0].evidence[0].sequence, [1, 2, 9, 3, 4, 5])
})

test('recent weights use canonical recency and deterministic number tie-breaking', () => {
  const records = [
    draw(1, [1, 2, 3, 4, 5, 6], '2025-01-01'),
    draw(2, [1, 3, 4, 5, 6, 7], '2026-01-01'),
    draw(3, [1, 4, 5, 6, 7, 8], '2026-01-02')
  ]
  const model = buildTransitionModel(records, { mode: 'recent' })
  const distribution = getNextNumberDistribution(model, [1])
  const byNumber = new Map(distribution.candidates.map(candidate => [candidate.number, candidate]))

  assert.equal(model.metadata.halfLife, RECENT_HALF_LIFE_DRAWS)
  assert.ok(Math.abs(byNumber.get(2).weightedCount - 0.5 ** (2 / 365)) < 1e-12)
  assert.ok(Math.abs(byNumber.get(3).weightedCount - 0.5 ** (1 / 365)) < 1e-12)
  assert.equal(distribution.candidates[0].number, 4)

  const ties = buildTransitionModel([
    draw(10, [9, 3, 4, 5, 6, 7], '2026-02-01'),
    draw(11, [9, 2, 4, 5, 6, 7], '2026-02-01')
  ], { mode: 'classic' })
  assert.deepEqual(getNextNumberDistribution(ties, [9]).candidates.map(candidate => candidate.number), [2, 3])
})

test('second-order selects sufficient contexts and explicitly backs off below eight samples', () => {
  const sufficient = chronologicalDraws(8, index => [1, 2, index % 2 ? 4 : 3, 10, 11, 12])
  const model = buildTransitionModel([
    ...sufficient,
    draw(2000, [9, 2, 5, 13, 14, 15], '2026-01-01')
  ], { mode: 'second-order' })
  const secondOrder = getNextNumberDistribution(model, [1, 2])
  const backoff = getNextNumberDistribution(model, [9, 2])

  assert.equal(secondOrder.source, 'second-order')
  assert.equal(secondOrder.sampleCount, 8)
  assert.deepEqual(secondOrder.candidates.map(candidate => candidate.number), [3, 4])
  assert.equal(secondOrder.candidates[0].evidence.every(row => row.sequence[0] === 1 && row.sequence[1] === 2), true)
  assert.equal(backoff.source, 'first-order-backoff')
  assert.equal(backoff.sampleCount, 9)
})

test('used candidates are removed and remaining probabilities are renormalized', () => {
  const model = buildTransitionModel([
    draw(1, [1, 2, 8, 9, 10, 11], '2026-01-01'),
    draw(2, [1, 2, 12, 13, 14, 15], '2026-01-02'),
    draw(3, [1, 3, 16, 17, 18, 19], '2026-01-03')
  ])
  const distribution = getNextNumberDistribution(model, [2, 1])

  assert.deepEqual(distribution.candidates.map(candidate => candidate.number), [3])
  assert.equal(distribution.candidates[0].historicalProbability, 1 / 3)
  assert.equal(distribution.candidates[0].pathProbability, 1)
  assert.equal(distribution.candidates.reduce((sum, candidate) => sum + candidate.pathProbability, 0), 1)
})

test('global fallback has exact count probabilities and uses uniform when history is empty', () => {
  const model = buildTransitionModel([draw(1, [1, 2, 3, 4, 5, 6], '2026-01-01')])
  const fallback = getNextNumberDistribution(model, [33])
  assert.equal(fallback.source, 'global-fallback')
  assert.deepEqual(fallback.candidates.slice(0, 6).map(candidate => candidate.number), [1, 2, 3, 4, 5, 6])
  assert.equal(fallback.candidates[0].pathProbability, 1 / 6)
  assert.equal(fallback.candidates.at(-1).pathProbability, 0)

  const empty = buildTransitionModel([])
  const uniform = getNextNumberDistribution(empty, [33])
  assert.equal(uniform.source, 'global-fallback')
  assert.equal(uniform.candidates.length, 32)
  assert.equal(uniform.candidates[0].pathProbability, 1 / 32)
  assert.equal(uniform.candidates.at(-1).pathProbability, 1 / 32)
})

test('greedy recalculates after every selection and always emits six unique balls', () => {
  const records = [
    ...Array.from({ length: 5 }, (_, index) => draw(100 + index, [1, 2, 3, 4, 5, 6], `2026-01-${String(index + 1).padStart(2, '0')}`)),
    ...Array.from({ length: 4 }, (_, index) => draw(200 + index, [1, 7, 8, 9, 10, 11], `2026-02-${String(index + 1).padStart(2, '0')}`))
  ]
  const result = generateGreedyChain(buildTransitionModel(records), 1)

  assert.deepEqual(result.drawOrder, [1, 2, 3, 4, 5, 6])
  assert.equal(new Set(result.drawOrder).size, 6)
  assert.deepEqual(result.steps.map(step => step.context), [[1], [2], [3], [4], [5]])
  assert.deepEqual(result.sortedBalls, [1, 2, 3, 4, 5, 6])
})

test('beam search returns three unique deterministic complete chains', () => {
  const records = [
    draw(1, [1, 2, 4, 6, 8, 10], '2026-01-01'),
    draw(2, [1, 3, 5, 7, 9, 11], '2026-01-02'),
    draw(3, [1, 2, 5, 8, 11, 14], '2026-01-03'),
    draw(4, [1, 3, 4, 7, 10, 13], '2026-01-04')
  ]
  const model = buildTransitionModel(records)
  const first = generateBeamChains(model, 1)
  const second = generateBeamChains(model, 1)

  assert.equal(first.chains.length, 3)
  assert.deepEqual(first, second)
  assert.equal(new Set(first.chains.map(chain => chain.drawOrder.join(','))).size, 3)
  assert.equal(first.chains.every(chain => chain.drawOrder.length === 6 && new Set(chain.drawOrder).size === 6), true)
  assert.equal(first.chains.every((chain, index) => index === 0 || first.chains[index - 1].score >= chain.score), true)
})

test('interactive latest windows use canonical latest records', () => {
  const records = chronologicalDraws(120, index => [1, (index % 27) + 7, 2, 3, 4, 5])
  const all = buildTransitionModel([...records].reverse(), { trainingWindow: 'all' })
  const latest50 = buildTransitionModel([...records].reverse(), { trainingWindow: 50 })
  const latest100 = buildTransitionModel(records, { trainingWindow: 100 })

  assert.equal(all.metadata.effectiveTrainingWindow, 120)
  assert.equal(latest50.records[0].issue, records[70].issue)
  assert.equal(latest50.records.at(-1).issue, records.at(-1).issue)
  assert.equal(latest100.records[0].issue, records[20].issue)
})

test('rolling backtest is leakage-free, uses trailing windows, deterministic starts, and exact baselines', () => {
  const records = chronologicalDraws(24, index => {
    if (index < 20) return index < 11 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
    if (index === 20) return [1, 13, 14, 15, 16, 17]
    return [7, 18, 19, 20, 21, 22]
  })
  const noFuture = backtestTransitionModel(records.slice(0, 21), {
    mode: 'classic', evaluationHorizon: 1, trainingWindows: [5], minimumTrainingRecords: 20
  })
  const withFuture = backtestTransitionModel(records, {
    mode: 'classic', evaluationHorizon: 4, trainingWindows: [5, 10], minimumTrainingRecords: 20
  })

  assert.equal(noFuture.comparisons[0].transitionMetrics.top1.hits, 0)
  assert.equal(withFuture.metadata.effectiveHorizon, 4)
  assert.equal(withFuture.comparisons[0].targets[0].trainingEndIssue, records[19].issue)
  assert.equal(withFuture.comparisons[0].targets[0].trainingStartIssue, records[15].issue)
  assert.equal(withFuture.comparisons[1].targets[0].trainingStartIssue, records[10].issue)
  assert.equal(withFuture.comparisons[0].targets[0].startNumber, 7)
  assert.ok(Math.abs(withFuture.comparisons[0].transitionMetrics.top1.baseline - (1 / 32 + 1 / 31 + 1 / 30 + 1 / 29 + 1 / 28) / 5) < 1e-15)
  assert.ok(Math.abs(withFuture.comparisons[0].transitionMetrics.top3.baseline - (3 / 32 + 3 / 31 + 3 / 30 + 3 / 29 + 3 / 28) / 5) < 1e-15)
})

test('backtest reports partial/insufficient horizons, overlap distribution, best targets, exact-six, and collisions', () => {
  const records = chronologicalDraws(23, () => [1, 2, 3, 4, 5, 6])
  const collisionChecker = (_source, generated) => ({ redBallCollision: generated.redBalls.join(',') === '1,2,3,4,5,6' })
  const result = backtestTransitionModel(records, {
    mode: 'classic', evaluationHorizon: 5, trainingWindow: 20, minimumTrainingRecords: 20,
    collisionHistory: records, collisionChecker
  })
  const comparison = result.comparisons[0]

  assert.equal(result.metadata.requestedHorizon, 5)
  assert.equal(result.metadata.effectiveHorizon, 3)
  assert.equal(result.metadata.skippedTargets, 2)
  assert.deepEqual(comparison.generatedSetMetrics.matchDistribution, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3 })
  assert.equal(comparison.generatedSetMetrics.meanMatches, 6)
  assert.equal(comparison.generatedSetMetrics.bestMatchCount, 6)
  assert.equal(comparison.generatedSetMetrics.exactSixCount, 3)
  assert.equal(comparison.generatedSetMetrics.bestTargets.length, 3)
  assert.equal(comparison.targets.every(target => target.collision.redBallCollision), true)

  const insufficient = backtestTransitionModel(records.slice(0, 20), { evaluationHorizon: 1 })
  assert.equal(insufficient.status, 'insufficient-history')
  assert.equal(insufficient.metadata.effectiveHorizon, 0)
  assert.equal(insufficient.metadata.skippedTargets, 1)

  const shortHistory = backtestTransitionModel(records.slice(0, 10), { evaluationHorizon: 50 })
  assert.equal(shortHistory.metadata.effectiveHorizon, 0)
  assert.equal(shortHistory.metadata.skippedTargets, 10)
})

test('public data acceptance: 05 has 521 outgoing edges and 05 to 32 is 25 / 4.80%', async () => {
  const publicData = JSON.parse(await readFile(new URL('../data/lotto-data.json', import.meta.url), 'utf8'))
  const model = buildTransitionModel(publicData, { mode: 'classic', trainingWindow: 'all' })
  const distribution = getNextNumberDistribution(model, [5])
  const candidate32 = distribution.candidates.find(candidate => candidate.number === 32)

  assert.equal(distribution.sampleCount, 521)
  assert.equal(candidate32.count, 25)
  assert.equal((candidate32.historicalProbability * 100).toFixed(2), '4.80')
})
