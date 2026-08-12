const COLLISION_INDEX = Symbol('historicalCollisionIndex')

const RED_MIN = 1
const RED_MAX = 33
const BLUE_MIN = 1
const BLUE_MAX = 16

function toBallArray(value) {
  if (Array.isArray(value)) return [...value]
  if (typeof value === 'string' && value.trim()) return value.trim().split(/\s+/)
  return null
}

function toInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null

  const number = Number(value)
  return Number.isSafeInteger(number) ? number : null
}

function normalizeRedBalls(value, label) {
  const values = toBallArray(value)
  if (!values || values.length !== 6) {
    throw new TypeError(`${label} must contain exactly six red balls`)
  }

  const redBalls = values.map((value, index) => {
    const number = toInteger(value)
    if (number === null || number < RED_MIN || number > RED_MAX) {
      throw new RangeError(`${label}[${index}] must be an integer between 1 and 33`)
    }
    return number
  })

  if (new Set(redBalls).size !== 6) {
    throw new RangeError(`${label} must contain six unique red balls`)
  }

  return redBalls.sort((left, right) => left - right)
}

function normalizeBlueBall(value, label, optional) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    throw new TypeError(`${label} is required`)
  }

  const blueBall = toInteger(value)
  if (blueBall === null || blueBall < BLUE_MIN || blueBall > BLUE_MAX) {
    throw new RangeError(`${label} must be an integer between 1 and 16`)
  }
  return blueBall
}

function redBallKey(redBalls) {
  return redBalls.map(number => String(number).padStart(2, '0')).join('-')
}

function fullCombinationKey(redKey, blueBall) {
  return `${redKey}|${String(blueBall).padStart(2, '0')}`
}

function normalizeDrawOrder(value, expectedRedKey) {
  if (value === undefined || value === null || value === '') return null

  try {
    const values = toBallArray(value)
    if (!values || values.length !== 6) return null

    const drawOrder = values.map(toInteger)
    if (drawOrder.some(number => number === null || number < RED_MIN || number > RED_MAX)) {
      return null
    }
    if (new Set(drawOrder).size !== 6) return null
    if (redBallKey([...drawOrder].sort((left, right) => left - right)) !== expectedRedKey) {
      return null
    }
    return drawOrder
  } catch {
    return null
  }
}

function incrementReason(invalidReasons, reason) {
  invalidReasons[reason] = (invalidReasons[reason] || 0) + 1
}

function appendMatch(map, key, match) {
  const matches = map.get(key)
  if (matches) matches.push(match)
  else map.set(key, [match])
}

function cloneRedMatch(match) {
  return {
    issue: match.issue,
    openTime: match.openTime,
    redBalls: [...match.redBalls],
    blueBall: match.blueBall,
    drawOrder: match.drawOrder ? [...match.drawOrder] : null
  }
}

function cloneFullMatch(match) {
  return {
    issue: match.issue,
    openTime: match.openTime,
    redBalls: [...match.redBalls],
    blueBall: match.blueBall
  }
}

function repeatedKeyCount(map) {
  let count = 0
  for (const matches of map.values()) {
    if (matches.length > 1) count += 1
  }
  return count
}

/**
 * Build a reusable collision index from the complete available history.
 * Invalid rows are skipped and summarized in index.metadata.
 *
 * @param {Array<object>} history
 * @returns {object} an opaque index accepted by checkHistoricalCollision
 */
export function buildHistoricalCollisionIndex(history) {
  if (!Array.isArray(history)) {
    throw new TypeError('history must be an array')
  }

  const redBallMatchesByKey = new Map()
  const fullCombinationMatchesByKey = new Map()
  const invalidReasons = {}
  let validRows = 0

  history.forEach(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      incrementReason(invalidReasons, 'invalidRecord')
      return
    }

    let redBalls
    try {
      redBalls = normalizeRedBalls(
        record.redBalls ?? record.frontWinningNum ?? record.seqFrontWinningNum,
        'history red balls'
      )
    } catch {
      incrementReason(invalidReasons, 'invalidRedBalls')
      return
    }

    let blueBall
    try {
      blueBall = normalizeBlueBall(
        record.blueBall ?? record.backWinningNum ?? record.seqBackWinningNum,
        'history blue ball',
        true
      )
    } catch {
      incrementReason(invalidReasons, 'invalidBlueBall')
      return
    }

    const redKey = redBallKey(redBalls)
    const drawOrder = normalizeDrawOrder(
      record.drawOrder ?? record.seqFrontWinningNum,
      redKey
    )
    const common = Object.freeze({
      issue: record.issue ?? null,
      openTime: record.openTime ?? null,
      redBalls: Object.freeze([...redBalls]),
      blueBall,
      drawOrder: drawOrder ? Object.freeze([...drawOrder]) : null
    })

    appendMatch(redBallMatchesByKey, redKey, common)
    if (blueBall !== null) {
      appendMatch(fullCombinationMatchesByKey, fullCombinationKey(redKey, blueBall), common)
    }
    validRows += 1
  })

  for (const matches of redBallMatchesByKey.values()) Object.freeze(matches)
  for (const matches of fullCombinationMatchesByKey.values()) Object.freeze(matches)

  const invalidRows = history.length - validRows
  const metadata = Object.freeze({
    totalRows: history.length,
    validRows,
    invalidRows,
    invalidReasons: Object.freeze({ ...invalidReasons }),
    redBallKeyCount: redBallMatchesByKey.size,
    fullCombinationKeyCount: fullCombinationMatchesByKey.size,
    repeatedRedBallSets: repeatedKeyCount(redBallMatchesByKey),
    repeatedFullCombinationSets: repeatedKeyCount(fullCombinationMatchesByKey)
  })

  return Object.freeze({
    [COLLISION_INDEX]: true,
    redBallMatchesByKey,
    fullCombinationMatchesByKey,
    metadata
  })
}

function resolveIndex(historyOrIndex) {
  if (Array.isArray(historyOrIndex)) {
    return buildHistoricalCollisionIndex(historyOrIndex)
  }
  if (!historyOrIndex || historyOrIndex[COLLISION_INDEX] !== true) {
    throw new TypeError('first argument must be history or a historical collision index')
  }
  return historyOrIndex
}

/**
 * Check one generated number set against a collision index (or raw history).
 * A blue ball is optional; without one, only red-ball collisions are checked.
 *
 * @param {object|Array<object>} historyOrIndex
 * @param {{redBalls: Array<number|string>|string, blueBall?: number|string}} candidate
 */
export function checkHistoricalCollision(historyOrIndex, candidate) {
  const index = resolveIndex(historyOrIndex)
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new TypeError('candidate must be an object containing redBalls')
  }

  const redBalls = normalizeRedBalls(candidate.redBalls, 'redBalls')
  const blueBall = normalizeBlueBall(candidate.blueBall, 'blueBall', true)
  const redKey = redBallKey(redBalls)
  const redMatches = index.redBallMatchesByKey.get(redKey) || []
  const fullMatches = blueBall === null
    ? []
    : index.fullCombinationMatchesByKey.get(fullCombinationKey(redKey, blueBall)) || []

  return {
    redBallCollision: redMatches.length > 0,
    redBallMatches: redMatches.map(cloneRedMatch),
    fullCombinationCollision: fullMatches.length > 0,
    fullCombinationMatches: fullMatches.map(cloneFullMatch),
    metadata: {
      ...index.metadata,
      invalidReasons: { ...index.metadata.invalidReasons }
    }
  }
}
