import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  buildHistoricalCollisionIndex,
  checkHistoricalCollision
} from '../src/utils/historicalCollision.js'

const history = [
  {
    issue: '2025070',
    openTime: '2025-06-22',
    frontWinningNum: '02 03 15 21 22 33',
    backWinningNum: '06',
    seqFrontWinningNum: '33 02 21 03 22 15'
  },
  {
    issue: '2020045',
    openTime: '2020-06-04',
    frontWinningNum: '03 02 33 15 22 21',
    backWinningNum: '12',
    seqFrontWinningNum: '21 22 03 15 02 33'
  },
  {
    issue: '2020044',
    openTime: '2020-06-02',
    frontWinningNum: '01 05 09 12 24 30',
    backWinningNum: '06',
    seqFrontWinningNum: '30 05 01 24 09 12'
  }
]

test('normalizes draw order and returns every red-only match', () => {
  const index = buildHistoricalCollisionIndex(history)
  const result = checkHistoricalCollision(index, {
    redBalls: [33, 2, 21, 3, 22, 15]
  })

  assert.equal(result.redBallCollision, true)
  assert.deepEqual(result.redBallMatches, [
    {
      issue: '2025070',
      openTime: '2025-06-22',
      redBalls: [2, 3, 15, 21, 22, 33],
      blueBall: 6,
      drawOrder: [33, 2, 21, 3, 22, 15]
    },
    {
      issue: '2020045',
      openTime: '2020-06-04',
      redBalls: [2, 3, 15, 21, 22, 33],
      blueBall: 12,
      drawOrder: [21, 22, 3, 15, 2, 33]
    }
  ])
  assert.equal(result.fullCombinationCollision, false)
  assert.deepEqual(result.fullCombinationMatches, [])
})

test('checks the optional blue ball as an exact seven-number collision', () => {
  const index = buildHistoricalCollisionIndex(history)
  const exact = checkHistoricalCollision(index, {
    redBalls: ['33', '02', '21', '3', '22', '15'],
    blueBall: '06'
  })
  const differentBlue = checkHistoricalCollision(index, {
    redBalls: [2, 3, 15, 21, 22, 33],
    blueBall: 1
  })

  assert.equal(exact.redBallCollision, true)
  assert.equal(exact.fullCombinationCollision, true)
  assert.deepEqual(exact.fullCombinationMatches, [{
    issue: '2025070',
    openTime: '2025-06-22',
    redBalls: [2, 3, 15, 21, 22, 33],
    blueBall: 6
  }])
  assert.equal(differentBlue.redBallCollision, true)
  assert.equal(differentBlue.fullCombinationCollision, false)
})

test('reports no-match state without mutating candidate input', () => {
  const candidate = {
    redBalls: [6, 5, 4, 3, 2, 1],
    blueBall: 16
  }
  const before = structuredClone(candidate)
  const result = checkHistoricalCollision(buildHistoricalCollisionIndex(history), candidate)

  assert.deepEqual(candidate, before)
  assert.deepEqual(result, {
    redBallCollision: false,
    redBallMatches: [],
    fullCombinationCollision: false,
    fullCombinationMatches: [],
    metadata: {
      totalRows: 3,
      validRows: 3,
      invalidRows: 0,
      invalidReasons: {},
      redBallKeyCount: 2,
      fullCombinationKeyCount: 3,
      repeatedRedBallSets: 1,
      repeatedFullCombinationSets: 0
    }
  })
})

test('returned rows and metadata cannot mutate the reusable index', () => {
  const index = buildHistoricalCollisionIndex(history)
  const candidate = { redBalls: [2, 3, 15, 21, 22, 33], blueBall: 6 }
  const first = checkHistoricalCollision(index, candidate)

  first.redBallMatches[0].redBalls[0] = 33
  first.redBallMatches[0].drawOrder[0] = 1
  first.fullCombinationMatches.length = 0
  first.metadata.invalidReasons.injected = 1

  const second = checkHistoricalCollision(index, candidate)
  assert.deepEqual(second.redBallMatches[0].redBalls, [2, 3, 15, 21, 22, 33])
  assert.deepEqual(second.redBallMatches[0].drawOrder, [33, 2, 21, 3, 22, 15])
  assert.equal(second.fullCombinationMatches.length, 1)
  assert.deepEqual(second.metadata.invalidReasons, {})
})

test('skips invalid history rows, reports reasons, and never mutates history', () => {
  const rows = [
    ...history,
    null,
    { issue: 'bad-red-count', frontWinningNum: '01 02 03 04 05', backWinningNum: '01' },
    { issue: 'duplicate-red', frontWinningNum: '01 02 03 04 05 05', backWinningNum: '01' },
    { issue: 'bad-blue', frontWinningNum: '01 02 03 04 05 06', backWinningNum: '17' }
  ]
  const before = structuredClone(rows)
  const index = buildHistoricalCollisionIndex(rows)

  assert.deepEqual(rows, before)
  assert.deepEqual(index.metadata, {
    totalRows: 7,
    validRows: 3,
    invalidRows: 4,
    invalidReasons: {
      invalidRecord: 1,
      invalidRedBalls: 2,
      invalidBlueBall: 1
    },
    redBallKeyCount: 2,
    fullCombinationKeyCount: 3,
    repeatedRedBallSets: 1,
    repeatedFullCombinationSets: 0
  })
})

test('keeps a valid row when optional draw order is invalid or unavailable', () => {
  const index = buildHistoricalCollisionIndex([
    {
      issue: '1',
      openTime: '2026-01-01',
      frontWinningNum: '01 02 03 04 05 06',
      backWinningNum: '',
      seqFrontWinningNum: '01 02 03 04 05 07'
    }
  ])
  const result = checkHistoricalCollision(index, {
    redBalls: [1, 2, 3, 4, 5, 6]
  })

  assert.equal(index.metadata.validRows, 1)
  assert.deepEqual(result.redBallMatches, [{
    issue: '1',
    openTime: '2026-01-01',
    redBalls: [1, 2, 3, 4, 5, 6],
    blueBall: null,
    drawOrder: null
  }])
})

test('can build a sorted red key directly from draw-order history fields', () => {
  const index = buildHistoricalCollisionIndex([{
    issue: '2',
    openTime: '2026-01-03',
    seqFrontWinningNum: '06 01 05 02 04 03',
    seqBackWinningNum: '08'
  }])
  const result = checkHistoricalCollision(index, {
    redBalls: [1, 2, 3, 4, 5, 6],
    blueBall: 8
  })

  assert.equal(result.fullCombinationCollision, true)
  assert.deepEqual(result.redBallMatches[0].drawOrder, [6, 1, 5, 2, 4, 3])
})

test('rejects invalid generated candidates with descriptive errors', () => {
  const index = buildHistoricalCollisionIndex(history)

  assert.throws(
    () => checkHistoricalCollision(index, { redBalls: [1, 2, 3, 4, 5] }),
    /redBalls must contain exactly six/
  )
  assert.throws(
    () => checkHistoricalCollision(index, { redBalls: [1, 2, 3, 4, 5, 5] }),
    /redBalls must contain six unique/
  )
  assert.throws(
    () => checkHistoricalCollision(index, { redBalls: [0, 2, 3, 4, 5, 6] }),
    /redBalls\[0\].*1 and 33/
  )
  assert.throws(
    () => checkHistoricalCollision(index, { redBalls: [1, 2, 3, 4, 5, 6], blueBall: 17 }),
    /blueBall.*1 and 16/
  )
})

test('rejects invalid API inputs and accepts raw history as a convenience', () => {
  assert.throws(() => buildHistoricalCollisionIndex({}), /history must be an array/)
  assert.throws(() => checkHistoricalCollision({}, { redBalls: [1, 2, 3, 4, 5, 6] }), /collision index/)

  const result = checkHistoricalCollision(history, {
    redBalls: [2, 3, 15, 21, 22, 33]
  })
  assert.equal(result.redBallMatches.length, 2)
})

test('complete-history fixture has six repeated red sets and no repeated full combinations', async () => {
  const source = await readFile(new URL('../public/data/lotto-data.json', import.meta.url), 'utf8')
  const rows = JSON.parse(source)
  const index = buildHistoricalCollisionIndex(rows)

  assert.equal(index.metadata.totalRows, 3489)
  assert.equal(index.metadata.invalidRows, 0)
  assert.equal(index.metadata.repeatedRedBallSets, 6)
  assert.equal(index.metadata.repeatedFullCombinationSets, 0)

  const knownRepeat = checkHistoricalCollision(index, {
    redBalls: [33, 2, 21, 3, 22, 15],
    blueBall: 6
  })
  assert.deepEqual(knownRepeat.redBallMatches.map(row => row.issue), ['2025070', '2020045'])
  assert.equal(knownRepeat.fullCombinationMatches.length, 1)
})

test('reports every repeated historical issue for the same red-ball set', () => {
  const history = [
    {
      issue: '100',
      openTime: '2026-01-01',
      frontWinningNum: '01 02 03 04 05 06',
      backWinningNum: '07'
    },
    {
      issue: '101',
      openTime: '2026-01-02',
      frontWinningNum: '06 05 04 03 02 01',
      backWinningNum: '08'
    }
  ]
  const result = checkHistoricalCollision(history, {
    redBalls: [6, 1, 5, 2, 4, 3]
  })

  assert.equal(result.redBallCollision, true)
  assert.deepEqual(result.redBallMatches.map(match => match.issue), ['100', '101'])
  assert.equal(result.fullCombinationCollision, false)
})
