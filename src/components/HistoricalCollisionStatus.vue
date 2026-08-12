<template>
  <div
    class="collision-status"
    :class="[
      `collision-status--${statusKind}`,
      { 'collision-status--compact': compact }
    ]"
  >
    <a-alert
      :type="alertType"
      show-icon
      class="collision-status__alert"
    >
      {{ statusMessage }}
      <template #action v-if="hasCollision">
        <a-tag :color="statusTagColor" size="small">
          {{ matchSummary }}
        </a-tag>
      </template>
    </a-alert>

    <a-collapse
      v-if="hasCollision"
      class="collision-status__details"
      :bordered="false"
    >
      <a-collapse-item key="matches" :header="detailsHeader">
        <div class="collision-status__match-list">
          <article
            v-for="match in mergedMatches"
            :key="match.key"
            class="collision-match"
          >
            <header class="collision-match__header">
              <div class="collision-match__identity">
                <strong>第 {{ match.issue }} 期</strong>
                <span v-if="match.openTime" class="collision-match__date">
                  {{ match.openTime }}
                </span>
              </div>
              <a-tag :color="match.isFullCombination ? 'red' : 'orange'" size="small">
                {{ match.isFullCombination ? '完整组合相同' : '仅红球相同' }}
              </a-tag>
            </header>

            <div class="collision-match__numbers" aria-label="历史开奖号码">
              <span
                v-for="number in match.redBalls"
                :key="`red-${match.key}-${number}`"
                class="lotto-ball lotto-ball--red"
              >
                {{ formatBall(number) }}
              </span>
              <span
                v-if="match.blueBall !== undefined && match.blueBall !== null"
                class="lotto-ball lotto-ball--blue"
              >
                {{ formatBall(match.blueBall) }}
              </span>
            </div>

            <div
              v-if="Array.isArray(match.drawOrder) && match.drawOrder.length"
              class="collision-match__draw-order"
            >
              <span class="collision-match__label">历史开奖顺序</span>
              <span class="collision-match__sequence">
                {{ match.drawOrder.map(formatBall).join(' → ') }}
              </span>
            </div>
          </article>
        </div>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  collision: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const redBallMatches = computed(() => (
  Array.isArray(props.collision?.redBallMatches)
    ? props.collision.redBallMatches
    : []
))

const fullCombinationMatches = computed(() => (
  Array.isArray(props.collision?.fullCombinationMatches)
    ? props.collision.fullCombinationMatches
    : []
))

const hasRedBallCollision = computed(() => (
  Boolean(props.collision?.redBallCollision) || redBallMatches.value.length > 0
))

const hasFullCombinationCollision = computed(() => (
  Boolean(props.collision?.fullCombinationCollision) || fullCombinationMatches.value.length > 0
))

const hasCollision = computed(() => (
  hasRedBallCollision.value || hasFullCombinationCollision.value
))

const statusKind = computed(() => {
  if (hasFullCombinationCollision.value) return 'full'
  if (hasRedBallCollision.value) return 'red'
  return 'none'
})

const alertType = computed(() => {
  if (hasFullCombinationCollision.value) return 'error'
  if (hasRedBallCollision.value) return 'warning'
  return 'info'
})

const statusTagColor = computed(() => (
  hasFullCombinationCollision.value ? 'red' : 'orange'
))

const statusMessage = computed(() => {
  if (hasFullCombinationCollision.value) {
    return '完整号码组合曾在历史开奖中出现'
  }

  if (hasRedBallCollision.value) {
    return '红球组合曾在历史开奖中出现'
  }

  return '未与历史红球组合碰撞'
})

const fullMatchKeys = computed(() => new Set(
  fullCombinationMatches.value.map(matchIdentity)
))

const mergedMatches = computed(() => {
  const matches = new Map()

  for (const match of redBallMatches.value) {
    const identity = matchIdentity(match)
    matches.set(identity, {
      ...match,
      key: identity,
      isFullCombination: fullMatchKeys.value.has(identity)
    })
  }

  for (const match of fullCombinationMatches.value) {
    const identity = matchIdentity(match)
    const existing = matches.get(identity)
    matches.set(identity, {
      ...(existing || {}),
      ...match,
      key: identity,
      isFullCombination: true
    })
  }

  return [...matches.values()]
})

const matchSummary = computed(() => {
  const redCount = redBallMatches.value.length
  const fullCount = fullCombinationMatches.value.length

  if (hasFullCombinationCollision.value) {
    return `红球 ${redCount} 期 · 完整 ${fullCount} 期`
  }

  return `红球 ${redCount} 期`
})

const detailsHeader = computed(() => (
  `查看全部 ${mergedMatches.value.length} 期匹配记录`
))

function matchIdentity(match = {}) {
  const redBalls = Array.isArray(match.redBalls)
    ? [...match.redBalls].map(Number).sort((a, b) => a - b).join('-')
    : ''

  return [
    match.issue ?? '',
    match.openTime ?? '',
    redBalls,
    match.blueBall ?? ''
  ].join('|')
}

function formatBall(number) {
  const numeric = Number(number)
  return Number.isFinite(numeric) ? String(numeric).padStart(2, '0') : String(number)
}
</script>

<style scoped>
.collision-status {
  width: 100%;
  margin-top: 12px;
  text-align: left;
}

.collision-status__alert {
  border-radius: 6px;
}

.collision-status__details {
  margin-top: 6px;
  border-radius: 6px;
  background: var(--color-fill-1);
}

.collision-status__match-list {
  display: grid;
  gap: 10px;
}

.collision-match {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--color-neutral-3);
  border-radius: 6px;
  background: var(--color-bg-2);
}

.collision-match__header,
.collision-match__identity,
.collision-match__numbers,
.collision-match__draw-order {
  display: flex;
  align-items: center;
}

.collision-match__header {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.collision-match__identity {
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px 12px;
}

.collision-match__date,
.collision-match__label {
  color: var(--color-text-3);
  font-size: 12px;
}

.collision-match__numbers {
  flex-wrap: wrap;
  gap: 6px;
}

.lotto-ball {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
}

.lotto-ball--red {
  background: linear-gradient(135deg, #f53f3f, #ff7d00);
}

.lotto-ball--blue {
  margin-left: 4px;
  background: linear-gradient(135deg, #165dff, #3491fa);
}

.collision-match__draw-order {
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 10px;
}

.collision-match__sequence {
  overflow-wrap: anywhere;
  color: var(--color-text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.collision-status--compact {
  margin-top: 0;
  min-width: 190px;
}

.collision-status--compact :deep(.arco-alert) {
  padding: 6px 8px;
}

.collision-status--compact :deep(.arco-alert-content) {
  min-width: 0;
  font-size: 12px;
}

.collision-status--compact :deep(.arco-collapse-item-header) {
  padding: 6px 8px;
  font-size: 12px;
}

@media (max-width: 600px) {
  .collision-status--compact {
    min-width: 0;
  }

  .collision-match__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .collision-match {
    padding: 10px;
  }

  .lotto-ball {
    width: 26px;
    height: 26px;
    flex-basis: 26px;
  }
}
</style>
