export const RECENT_HALF_LIFE_DRAWS = 365
export const SECOND_ORDER_MIN_SAMPLES = 8

const RED_BALL_MIN = 1
const RED_BALL_MAX = 33
const DRAW_LENGTH = 6

function emptySkippedReasons() {
  return {
    missingIssue: 0,
    invalidIssue: 0,
    duplicateIssue: 0,
    missingOpenTime: 0,
    invalidOpenTime: 0,
    invalidSequence: 0
  }
}

function parseCalendarDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return { value: value.trim(), timestamp }
}

function parseSequence(record) {
  const raw = Array.isArray(record?.sequence)
    ? record.sequence
    : typeof record?.seqFrontWinningNum === 'string'
      ? record.seqFrontWinningNum.trim().split(/\s+/)
      : null
  if (!raw || raw.length !== DRAW_LENGTH) return null
  const sequence = raw.map(value => {
    if (typeof value === 'number') return value
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
    return Number.NaN
  })
  if (
    sequence.some(number => !Number.isInteger(number) || number < RED_BALL_MIN || number > RED_BALL_MAX) ||
    new Set(sequence).size !== DRAW_LENGTH
  ) return null
  return sequence
}

function recordSkip(metadata, reason) {
  metadata.skippedRecordCount += 1
  metadata.skippedByReason[reason] += 1
}

export function normalizeDrawSequences(records) {
  const input = Array.isArray(records) ? records : []
  const metadata = {
    inputRecordCount: input.length,
    validRecordCount: 0,
    skippedRecordCount: 0,
    skippedByReason: emptySkippedReasons()
  }
  const validCandidates = []

  input.forEach(record => {
    const rawIssue = record?.issue
    if (rawIssue === null || rawIssue === undefined || String(rawIssue).trim() === '') {
      recordSkip(metadata, 'missingIssue')
      return
    }
    const issue = String(rawIssue).trim()
    if (!/^\d+$/.test(issue)) {
      recordSkip(metadata, 'invalidIssue')
      return
    }
    if (record?.openTime === null || record?.openTime === undefined || String(record.openTime).trim() === '') {
      recordSkip(metadata, 'missingOpenTime')
      return
    }
    const parsedDate = parseCalendarDate(String(record.openTime))
    if (!parsedDate) {
      recordSkip(metadata, 'invalidOpenTime')
      return
    }
    const sequence = parseSequence(record)
    if (!sequence) {
      recordSkip(metadata, 'invalidSequence')
      return
    }
    validCandidates.push({
      issue,
      openTime: parsedDate.value,
      sequence: [...sequence],
      _timestamp: parsedDate.timestamp,
      _issueNumber: BigInt(issue),
      _issueKey: BigInt(issue).toString()
    })
  })

  validCandidates.sort((left, right) => {
    if (left._issueNumber !== right._issueNumber) {
      return left._issueNumber < right._issueNumber ? -1 : 1
    }
    if (left._timestamp !== right._timestamp) return left._timestamp - right._timestamp
    const leftSequence = left.sequence.join(',')
    const rightSequence = right.sequence.join(',')
    return leftSequence.localeCompare(rightSequence) || left.issue.localeCompare(right.issue)
  })
  const normalized = []
  const seenIssues = new Set()
  validCandidates.forEach(record => {
    if (seenIssues.has(record._issueKey)) {
      recordSkip(metadata, 'duplicateIssue')
      return
    }
    seenIssues.add(record._issueKey)
    normalized.push(record)
  })
  normalized.sort((left, right) => {
    if (left._timestamp !== right._timestamp) return left._timestamp - right._timestamp
    return left._issueNumber < right._issueNumber ? -1 : left._issueNumber > right._issueNumber ? 1 : 0
  })
  metadata.validRecordCount = normalized.length

  return {
    records: normalized.map(({ issue, openTime, sequence }) => ({ issue, openTime, sequence })),
    metadata
  }
}

function validateMode(mode) {
  if (!['classic', 'recent', 'second-order'].includes(mode)) {
    throw new RangeError(`Unknown transition mode: ${mode}`)
  }
  return mode
}

function validateBall(number, label = 'number') {
  if (!Number.isInteger(number) || number < RED_BALL_MIN || number > RED_BALL_MAX) {
    throw new RangeError(`${label} must be an integer from 1 to 33`)
  }
}

function resolveTrainingWindow(value, validCount) {
  if (value === null || value === undefined || value === 'all') return null
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError('trainingWindow must be a positive integer or "all"')
  }
  return Math.min(value, validCount)
}

function addCandidate(map, key, number, record, weight = 1) {
  let bucket = map.get(key)
  if (!bucket) {
    bucket = { total: 0, weightedTotal: 0, candidates: new Map() }
    map.set(key, bucket)
  }
  bucket.total += 1
  bucket.weightedTotal += weight
  let candidate = bucket.candidates.get(number)
  if (!candidate) {
    candidate = { number, count: 0, weightedCount: 0, evidence: [] }
    bucket.candidates.set(number, candidate)
  }
  candidate.count += 1
  candidate.weightedCount += weight
  candidate.evidence.push({
    issue: record.issue,
    openTime: record.openTime,
    sequence: [...record.sequence]
  })
}

function buildFromNormalized(records, normalizationMetadata, options = {}) {
  const mode = validateMode(options.mode ?? 'classic')
  const requestedTrainingWindow = options.trainingWindow ?? null
  const resolvedWindow = resolveTrainingWindow(requestedTrainingWindow, records.length)
  const trainingRecords = resolvedWindow === null ? records : records.slice(-resolvedWindow)
  const firstOrder = new Map()
  const weightedFirstOrder = new Map()
  const secondOrder = new Map()
  const globalCounts = new Map()
  const globalEvidence = new Map()

  trainingRecords.forEach((record, index) => {
    const recencyRank = trainingRecords.length - 1 - index
    const recentWeight = 0.5 ** (recencyRank / RECENT_HALF_LIFE_DRAWS)
    record.sequence.forEach(number => {
      globalCounts.set(number, (globalCounts.get(number) ?? 0) + 1)
      const evidence = globalEvidence.get(number) ?? []
      evidence.push({ issue: record.issue, openTime: record.openTime, sequence: [...record.sequence] })
      globalEvidence.set(number, evidence)
    })
    for (let edge = 0; edge < record.sequence.length - 1; edge += 1) {
      const source = record.sequence[edge]
      const target = record.sequence[edge + 1]
      addCandidate(firstOrder, source, target, record)
      addCandidate(weightedFirstOrder, source, target, record, recentWeight)
    }
    for (let triple = 0; triple < record.sequence.length - 2; triple += 1) {
      const key = `${record.sequence[triple]},${record.sequence[triple + 1]}`
      addCandidate(secondOrder, key, record.sequence[triple + 2], record)
    }
  })

  const effectiveTrainingWindow = trainingRecords.length
  return {
    mode,
    records: trainingRecords.map(record => ({
      issue: record.issue,
      openTime: record.openTime,
      sequence: [...record.sequence]
    })),
    firstOrder,
    weightedFirstOrder,
    secondOrder,
    globalCounts,
    globalEvidence,
    metadata: {
      ...normalizationMetadata,
      requestedTrainingWindow,
      effectiveTrainingWindow,
      trainingRecordCount: effectiveTrainingWindow,
      halfLife: RECENT_HALF_LIFE_DRAWS,
      secondOrderMinSamples: SECOND_ORDER_MIN_SAMPLES
    }
  }
}

export function buildTransitionModel(records, options = {}) {
  const normalized = normalizeDrawSequences(records)
  return buildFromNormalized(normalized.records, normalized.metadata, options)
}

function compareCandidates(left, right) {
  return right.pathProbability - left.pathProbability ||
    right.count - left.count ||
    left.number - right.number
}

function observedDistribution(bucket, usedNumbers, source, context, useWeights) {
  const originalDenominator = useWeights ? bucket.weightedTotal : bucket.total
  const available = [...bucket.candidates.values()].filter(candidate => !usedNumbers.has(candidate.number))
  if (available.length === 0) return null
  const availableDenominator = available.reduce(
    (sum, candidate) => sum + (useWeights ? candidate.weightedCount : candidate.count),
    0
  )
  const candidates = available.map(candidate => {
    const numerator = useWeights ? candidate.weightedCount : candidate.count
    const historicalProbability = originalDenominator > 0 ? numerator / originalDenominator : 0
    return {
      number: candidate.number,
      count: candidate.count,
      weightedCount: candidate.weightedCount,
      probability: historicalProbability,
      historicalProbability,
      pathProbability: numerator / availableDenominator,
      evidence: candidate.evidence.map(row => ({ ...row, sequence: [...row.sequence] }))
    }
  }).sort(compareCandidates)
  return {
    mode: source === 'recent' ? 'recent' : source === 'second-order' ? 'second-order' : 'classic',
    source,
    context,
    sampleCount: bucket.total,
    weightedSampleCount: bucket.weightedTotal,
    candidates
  }
}

function fallbackDistribution(model, usedNumbers, context, priorSource) {
  const remaining = []
  for (let number = RED_BALL_MIN; number <= RED_BALL_MAX; number += 1) {
    if (!usedNumbers.has(number)) remaining.push(number)
  }
  const historicalTotal = [...model.globalCounts.values()].reduce((sum, count) => sum + count, 0)
  const remainingTotal = remaining.reduce((sum, number) => sum + (model.globalCounts.get(number) ?? 0), 0)
  const uniform = remainingTotal === 0
  const candidates = remaining.map(number => {
    const count = model.globalCounts.get(number) ?? 0
    const historicalProbability = historicalTotal > 0 ? count / historicalTotal : 1 / RED_BALL_MAX
    return {
      number,
      count,
      weightedCount: count,
      probability: historicalProbability,
      historicalProbability,
      pathProbability: uniform ? 1 / remaining.length : count / remainingTotal,
      evidence: (model.globalEvidence.get(number) ?? []).map(row => ({ ...row, sequence: [...row.sequence] }))
    }
  }).sort(compareCandidates)
  return {
    mode: model.mode,
    source: 'global-fallback',
    priorSource,
    context,
    sampleCount: 0,
    weightedSampleCount: 0,
    candidates
  }
}

export function getNextNumberDistribution(model, path, options = {}) {
  if (!model || !(model.firstOrder instanceof Map)) throw new TypeError('A valid transition model is required')
  if (!Array.isArray(path) || path.length === 0) throw new TypeError('path must contain at least one number')
  path.forEach((number, index) => validateBall(number, `path[${index}]`))
  if (new Set(path).size !== path.length) throw new RangeError('path numbers must be unique')
  const mode = validateMode(options.mode ?? model.mode ?? 'classic')
  const usedNumbers = new Set(path)
  const current = path.at(-1)
  let selected = null
  let source
  let context

  if (mode === 'second-order') {
    let secondOrderWasEligible = false
    if (path.length >= 2) {
      context = [path.at(-2), current]
      const secondBucket = model.secondOrder.get(`${context[0]},${context[1]}`)
      if (secondBucket && secondBucket.total >= (options.secondOrderMinSamples ?? model.metadata.secondOrderMinSamples)) {
        secondOrderWasEligible = true
        source = 'second-order'
        selected = observedDistribution(secondBucket, usedNumbers, source, context, false)
      }
    }
    if (!selected && !secondOrderWasEligible) {
      source = 'first-order-backoff'
      context = [current]
      const firstBucket = model.firstOrder.get(current)
      if (firstBucket) selected = observedDistribution(firstBucket, usedNumbers, source, context, false)
    }
  } else {
    source = mode
    context = [current]
    const map = mode === 'recent' ? model.weightedFirstOrder : model.firstOrder
    const bucket = map.get(current)
    if (bucket) selected = observedDistribution(bucket, usedNumbers, source, context, mode === 'recent')
  }

  const distribution = selected ?? fallbackDistribution(model, usedNumbers, context ?? [current], source ?? mode)
  return {
    ...distribution,
    usedNumbers: [...path],
    availableCandidateCount: distribution.candidates.length,
    eligibleNumberCount: RED_BALL_MAX - usedNumbers.size
  }
}

function selectedStep(distribution, candidate) {
  return {
    number: candidate.number,
    source: distribution.source,
    model: distribution.source,
    context: [...distribution.context],
    sampleCount: distribution.sampleCount,
    weightedSampleCount: distribution.weightedSampleCount,
    count: candidate.count,
    weightedCount: candidate.weightedCount,
    probability: candidate.historicalProbability,
    historicalProbability: candidate.historicalProbability,
    pathProbability: candidate.pathProbability,
    evidence: candidate.evidence
  }
}

export function generateGreedyChain(model, startNumber, options = {}) {
  validateBall(startNumber, 'startNumber')
  const mode = validateMode(options.mode ?? model?.mode ?? 'classic')
  const drawOrder = [startNumber]
  const steps = []
  let score = 0
  while (drawOrder.length < DRAW_LENGTH) {
    const distribution = getNextNumberDistribution(model, drawOrder, { ...options, mode })
    const candidate = distribution.candidates[0]
    if (!candidate) throw new Error('Unable to generate a complete unique chain')
    drawOrder.push(candidate.number)
    steps.push(selectedStep(distribution, candidate))
    score += Math.log(candidate.pathProbability)
  }
  return {
    startNumber,
    mode,
    drawOrder,
    sortedBalls: [...drawOrder].sort((left, right) => left - right),
    steps,
    score
  }
}

function comparePaths(left, right) {
  if (left.score !== right.score) return right.score - left.score
  for (let index = 0; index < Math.min(left.drawOrder.length, right.drawOrder.length); index += 1) {
    if (left.drawOrder[index] !== right.drawOrder[index]) return left.drawOrder[index] - right.drawOrder[index]
  }
  return left.drawOrder.length - right.drawOrder.length
}

export function generateBeamChains(model, startNumber, options = {}) {
  validateBall(startNumber, 'startNumber')
  const mode = validateMode(options.mode ?? model?.mode ?? 'classic')
  const beamWidth = options.beamWidth ?? 8
  const expansionWidth = options.expansionWidth ?? 8
  const resultCount = options.resultCount ?? 3
  for (const [label, value] of Object.entries({ beamWidth, expansionWidth, resultCount })) {
    if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer`)
  }
  let beam = [{ drawOrder: [startNumber], steps: [], score: 0 }]
  while (beam[0].drawOrder.length < DRAW_LENGTH) {
    const expanded = []
    beam.forEach(path => {
      const distribution = getNextNumberDistribution(model, path.drawOrder, { ...options, mode })
      distribution.candidates.slice(0, expansionWidth).forEach(candidate => {
        expanded.push({
          drawOrder: [...path.drawOrder, candidate.number],
          steps: [...path.steps, selectedStep(distribution, candidate)],
          score: path.score + Math.log(candidate.pathProbability)
        })
      })
    })
    const distinct = new Map()
    expanded.sort(comparePaths).forEach(path => {
      const key = path.drawOrder.join(',')
      if (!distinct.has(key)) distinct.set(key, path)
    })
    beam = [...distinct.values()].slice(0, beamWidth)
  }
  const chains = beam.sort(comparePaths).slice(0, resultCount).map(path => ({
    ...path,
    sortedBalls: [...path.drawOrder].sort((left, right) => left - right)
  }))
  return { startNumber, mode, beamWidth, expansionWidth, chains, alternatives: chains }
}

function normalizeTrainingWindows(options) {
  const raw = options.trainingWindows ?? (options.trainingWindow !== undefined ? [options.trainingWindow] : [50, 100])
  if (!Array.isArray(raw) || raw.length === 0) throw new RangeError('trainingWindows must contain at least one window')
  return raw.map(window => {
    if (window === null || window === 'all') return null
    if (!Number.isInteger(window) || window <= 0) throw new RangeError('Each training window must be a positive integer or "all"')
    return window
  })
}

function resolveHorizon(options) {
  const horizon = options.evaluationHorizon ?? options.horizon ?? 50
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 500) {
    throw new RangeError('evaluationHorizon must be an integer from 1 to 500')
  }
  return horizon
}

function deterministicStart(records) {
  const counts = new Map()
  records.forEach(record => {
    const number = record.sequence[0]
    counts.set(number, (counts.get(number) ?? 0) + 1)
  })
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 1
}

function maybeCollision(options, generatedBalls) {
  if (typeof options.collisionChecker !== 'function') return null
  const source = options.collisionIndex ?? options.collisionHistory ?? []
  return options.collisionChecker(source, { redBalls: generatedBalls })
}

function emptyBacktestMetrics() {
  return {
    matchDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    meanMatches: 0,
    bestMatchCount: 0,
    exactSixCount: 0,
    bestTargets: []
  }
}

function evaluateWindow(allRecords, targetEntries, window, mode, normalizationMetadata, options) {
  const transition = {
    top1: { hits: 0, rate: 0, baseline: 0 },
    top3: { hits: 0, rate: 0, baseline: 0 },
    top5: { hits: 0, rate: 0, baseline: 0 }
  }
  const baselineSums = { top1: 0, top3: 0, top5: 0 }
  const generatedSetMetrics = emptyBacktestMetrics()
  const targets = []
  let evaluatedTransitions = 0

  targetEntries.forEach(({ target, index }) => {
    const trainingStart = window === null ? 0 : Math.max(0, index - window)
    const trainingRecords = allRecords.slice(trainingStart, index)
    const model = buildFromNormalized(trainingRecords, {
      ...normalizationMetadata,
      inputRecordCount: trainingRecords.length,
      validRecordCount: trainingRecords.length,
      skippedRecordCount: 0,
      skippedByReason: emptySkippedReasons()
    }, { mode, trainingWindow: null })

    for (let decision = 1; decision < DRAW_LENGTH; decision += 1) {
      const path = target.sequence.slice(0, decision)
      const actual = target.sequence[decision]
      const distribution = getNextNumberDistribution(model, path, { mode })
      const ranked = distribution.candidates.map(candidate => candidate.number)
      const available = RED_BALL_MAX - path.length
      for (const k of [1, 3, 5]) {
        const key = `top${k}`
        if (ranked.slice(0, k).includes(actual)) transition[key].hits += 1
        baselineSums[key] += Math.min(k, available) / available
      }
      evaluatedTransitions += 1
    }

    const startNumber = deterministicStart(trainingRecords)
    const generated = generateGreedyChain(model, startNumber, { mode })
    const actualSet = new Set(target.sequence)
    const overlappingNumbers = generated.sortedBalls.filter(number => actualSet.has(number))
    const matchCount = overlappingNumbers.length
    generatedSetMetrics.matchDistribution[matchCount] += 1
    generatedSetMetrics.exactSixCount += matchCount === DRAW_LENGTH ? 1 : 0
    const row = {
      issue: target.issue,
      openTime: target.openTime,
      trainingStartIssue: trainingRecords[0]?.issue ?? null,
      trainingEndIssue: trainingRecords.at(-1)?.issue ?? null,
      trainingRecordCount: trainingRecords.length,
      startNumber,
      generatedDrawOrder: generated.drawOrder,
      generatedSortedSet: generated.sortedBalls,
      actualSortedSet: [...target.sequence].sort((left, right) => left - right),
      overlappingNumbers,
      matchCount,
      collision: maybeCollision(options, generated.sortedBalls)
    }
    targets.push(row)
  })

  for (const key of ['top1', 'top3', 'top5']) {
    transition[key].rate = evaluatedTransitions ? transition[key].hits / evaluatedTransitions : 0
    transition[key].baseline = evaluatedTransitions ? baselineSums[key] / evaluatedTransitions : 0
  }
  if (targets.length) {
    generatedSetMetrics.meanMatches = targets.reduce((sum, target) => sum + target.matchCount, 0) / targets.length
    generatedSetMetrics.bestMatchCount = Math.max(...targets.map(target => target.matchCount))
    generatedSetMetrics.bestTargets = targets.filter(target => target.matchCount === generatedSetMetrics.bestMatchCount)
  }

  return {
    trainingWindow: window,
    requestedTrainingWindow: window,
    evaluatedTargets: targets.length,
    evaluatedTransitions,
    transitionMetrics: transition,
    generatedSetMetrics,
    targets
  }
}

export function backtestTransitionModel(records, options = {}) {
  const mode = validateMode(options.mode ?? 'classic')
  const requestedHorizon = resolveHorizon(options)
  const minimumTrainingRecords = options.minimumTrainingRecords ?? 20
  if (!Number.isInteger(minimumTrainingRecords) || minimumTrainingRecords < 1) {
    throw new RangeError('minimumTrainingRecords must be a positive integer')
  }
  const windows = normalizeTrainingWindows(options)
  const normalized = normalizeDrawSequences(records)
  const eligible = normalized.records
    .map((target, index) => ({ target, index }))
    .filter(entry => entry.index >= minimumTrainingRecords)
  const targetEntries = eligible.slice(-requestedHorizon)
  const comparisons = windows.map(window => evaluateWindow(
    normalized.records,
    targetEntries,
    window,
    mode,
    normalized.metadata,
    options
  ))
  const effectiveHorizon = targetEntries.length
  const availableTargetCount = Math.min(requestedHorizon, normalized.records.length)
  return {
    mode,
    status: effectiveHorizon > 0 ? 'ok' : 'insufficient-history',
    metadata: {
      ...normalized.metadata,
      requestedHorizon,
      effectiveHorizon,
      skippedTargets: availableTargetCount - effectiveHorizon,
      eligibleTargetCount: eligible.length,
      minimumTrainingRecords,
      trainingWindows: windows
    },
    comparisons,
    results: comparisons
  }
}
