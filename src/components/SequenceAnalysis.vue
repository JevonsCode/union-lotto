<template>
  <a-card class="transition-card">
    <template #title>
      <div class="title-block">
        <span>历史相邻号码推演</span>
        <small>统计开奖原始顺序中“当前号码 → 紧邻下一号码”的条件概率</small>
      </div>
    </template>

    <a-alert
      type="warning"
      show-icon
      class="disclaimer"
    >
      统计频率不等于未来中奖概率；每期开奖相互独立，本工具仅用于验证历史规律、比较算法和回测表现。
    </a-alert>

    <div class="controls">
      <a-form-item label="起始红球">
        <a-select v-model="startNumber" style="width: 120px" @change="refreshAnalysis">
          <a-option v-for="number in 33" :key="number" :value="number">
            {{ formatBall(number) }}
          </a-option>
        </a-select>
      </a-form-item>

      <a-form-item label="算法模型">
        <a-radio-group v-model="mode" type="button" @change="refreshAnalysis">
          <a-radio value="classic">经典相邻</a-radio>
          <a-radio value="recent">近期加权</a-radio>
          <a-radio value="second-order">二阶链</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item label="训练范围">
        <a-select v-model="windowChoice" style="width: 150px" @change="refreshAnalysis">
          <a-option value="all">全部历史</a-option>
          <a-option value="50">最近 50 期</a-option>
          <a-option value="100">最近 100 期</a-option>
          <a-option value="custom">自定义</a-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="windowChoice === 'custom'" label="自定义期数">
        <a-input-number
          v-model="customWindow"
          :min="20"
          :max="Math.max(20, activeRecords.length)"
          @change="refreshAnalysis"
        />
      </a-form-item>

      <a-button type="primary" :loading="analyzing" @click="refreshAnalysis">
        重新推演
      </a-button>
    </div>

    <a-alert v-if="errorMessage" type="error" show-icon closable>{{ errorMessage }}</a-alert>

    <template v-if="model && distribution">
      <div class="summary-grid">
        <a-statistic title="有效训练期数" :value="model.metadata.effectiveTrainingWindow" suffix="期" />
        <a-statistic title="无效记录" :value="model.metadata.skippedRecordCount" suffix="条" />
        <a-statistic title="当前号码后继样本" :value="distribution.sampleCount" suffix="次" />
        <a-statistic title="候选号码" :value="distribution.availableCandidateCount" suffix="个" />
      </div>

      <section class="section">
        <div class="section-heading">
          <div>
            <h3>{{ formatBall(startNumber) }} 后面紧跟什么？</h3>
            <p>分母是 {{ formatBall(startNumber) }} 实际拥有紧邻后继的 {{ distribution.sampleCount }} 次，不是总期数。</p>
          </div>
          <a-button v-if="distribution.candidates.length > 10" type="text" @click="showAllCandidates = !showAllCandidates">
            {{ showAllCandidates ? '收起' : `查看全部 ${distribution.candidates.length} 个` }}
          </a-button>
        </div>

        <div v-if="visibleCandidates.length" class="candidate-list">
          <div v-for="(candidate, index) in visibleCandidates" :key="candidate.number" class="candidate-row">
            <span class="rank">{{ index + 1 }}</span>
            <span class="ball red">{{ formatBall(candidate.number) }}</span>
            <div class="bar-wrap">
              <div class="bar" :style="{ width: `${barWidth(candidate)}%` }"></div>
            </div>
            <strong>{{ percent(candidate.historicalProbability ?? candidate.probability) }}</strong>
            <span class="count">{{ candidate.count }} 次</span>
            <a-button type="text" size="mini" @click="showEvidence(candidate)">历史证据</a-button>
          </div>
        </div>
        <a-empty v-else description="该号码在当前训练范围内没有紧邻后继记录" />
      </section>

      <section v-if="greedy" class="section chain-section">
        <div class="section-heading">
          <div>
            <h3>贪心推演链</h3>
            <p>每一步都用新号码重新计算，而不是重复使用起始号码排行。</p>
          </div>
        </div>
        <div class="chain">
          <template v-for="(number, index) in greedy.drawOrder" :key="`${number}-${index}`">
            <span v-if="index" class="arrow">→</span>
            <span class="ball large" :class="index === 0 ? 'start' : 'red'">{{ formatBall(number) }}</span>
          </template>
        </div>
        <div class="sorted-result">
          <span>排序号码：</span>
          <span v-for="number in greedy.sortedBalls" :key="number" class="ball red">{{ formatBall(number) }}</span>
        </div>
        <div class="step-grid">
          <div v-for="(step, index) in greedy.steps" :key="index" class="step-card">
            <b>{{ formatBall(greedy.drawOrder[index]) }} → {{ formatBall(step.number) }}</b>
            <span>{{ sourceLabel(step.source) }}</span>
            <span>历史 {{ percent(step.historicalProbability ?? step.probability) }}</span>
            <span>路径 {{ percent(step.pathProbability ?? step.probability) }}</span>
            <small>样本 {{ step.sampleCount }} 次</small>
          </div>
        </div>
        <HistoricalCollisionStatus v-if="greedy.collision" :collision="greedy.collision" />
      </section>

      <section v-if="beamChains.length" class="section">
        <div class="section-heading">
          <div>
            <h3>全局路径 Top 3</h3>
            <p>Beam Search 同时保留多条高分路径，避免只看局部最高概率。</p>
          </div>
        </div>
        <div class="beam-grid">
          <article v-for="(chain, index) in beamChains" :key="chain.drawOrder.join('-')" class="beam-card">
            <a-tag :color="index === 0 ? 'purple' : 'arcoblue'">第 {{ index + 1 }} 名</a-tag>
            <div class="mini-chain">
              <span v-for="number in chain.drawOrder" :key="number" class="ball red">{{ formatBall(number) }}</span>
            </div>
            <small>路径分数 {{ chain.score.toFixed(3) }}</small>
            <HistoricalCollisionStatus v-if="chain.collision" :collision="chain.collision" compact />
          </article>
        </div>
      </section>

      <section class="section backtest-section">
        <div class="section-heading">
          <div>
            <h3>严格滚动回测</h3>
            <p>每个目标期只使用它之前的数据；比较最近 50 期与 100 期训练窗口。</p>
          </div>
          <div class="backtest-controls">
            <a-select v-model="horizonChoice" style="width: 145px">
              <a-option value="50">回测最近 50 期</a-option>
              <a-option value="100">回测最近 100 期</a-option>
              <a-option value="custom">自定义</a-option>
            </a-select>
            <a-input-number v-if="horizonChoice === 'custom'" v-model="customHorizon" :min="1" :max="500" />
            <a-button type="primary" :loading="backtesting" @click="runBacktest">开始回测</a-button>
          </div>
        </div>

        <div v-if="backtest?.status === 'ok'" class="backtest-results">
          <a-alert
            type="info"
            show-icon
          >
            实际评估 {{ backtest.metadata.effectiveHorizon }} 期；“中一次”按 6 个红球全部一致计算。
          </a-alert>
          <div class="comparison-grid">
            <article v-for="result in backtest.comparisons" :key="result.trainingWindow" class="window-card">
              <h4>训练窗口 {{ result.trainingWindow }} 期</h4>
              <div class="metric-row">
                <span>Top 1</span><b>{{ percent(result.transitionMetrics.top1.rate) }}</b>
                <small>随机基线 {{ percent(result.transitionMetrics.top1.baseline) }}</small>
              </div>
              <div class="metric-row">
                <span>Top 3</span><b>{{ percent(result.transitionMetrics.top3.rate) }}</b>
                <small>随机基线 {{ percent(result.transitionMetrics.top3.baseline) }}</small>
              </div>
              <div class="metric-row">
                <span>Top 5</span><b>{{ percent(result.transitionMetrics.top5.rate) }}</b>
                <small>随机基线 {{ percent(result.transitionMetrics.top5.baseline) }}</small>
              </div>
              <a-divider />
              <div class="match-summary">
                <a-statistic title="平均命中红球" :value="result.generatedSetMetrics.meanMatches" :precision="2" suffix="个" />
                <a-statistic title="最高命中" :value="result.generatedSetMetrics.bestMatchCount" suffix="个" />
                <a-statistic title="6 红全中" :value="result.generatedSetMetrics.exactSixCount" suffix="次" />
              </div>
              <div class="distribution">
                <span v-for="matches in 7" :key="matches - 1">
                  {{ matches - 1 }}球：{{ result.generatedSetMetrics.matchDistribution[matches - 1] || 0 }}期
                </span>
              </div>
              <a-collapse v-if="getCollisionTargets(result).length" class="collision-targets">
                <a-collapse-item :header="`查看 ${getCollisionTargets(result).length} 条历史碰撞推演`" key="collisions">
                  <div v-for="target in getCollisionTargets(result)" :key="`collision-${target.issue}`" class="target-row">
                    <b>目标第 {{ target.issue }} 期 · {{ target.openTime }}</b>
                    <span>推演：{{ formatBalls(target.generatedSortedSet) }}</span>
                    <span>实际：{{ formatBalls(target.actualSortedSet) }}</span>
                    <HistoricalCollisionStatus :collision="target.collision" compact />
                  </div>
                </a-collapse-item>
              </a-collapse>
              <a-collapse v-if="result.generatedSetMetrics.bestTargets.length">
                <a-collapse-item header="查看最佳命中期" key="best">
                  <div v-for="target in result.generatedSetMetrics.bestTargets" :key="target.issue" class="target-row">
                    <b>第 {{ target.issue }} 期 · {{ target.openTime }}</b>
                    <span>推演：{{ formatBalls(target.generatedSortedSet) }}</span>
                    <span>实际：{{ formatBalls(target.actualSortedSet) }}</span>
                    <span>重合：{{ formatBalls(target.overlappingNumbers) }}</span>
                    <HistoricalCollisionStatus v-if="target.collision" :collision="target.collision" compact />
                  </div>
                </a-collapse-item>
              </a-collapse>
            </article>
          </div>
        </div>
        <a-empty
          v-else-if="backtest?.status === 'insufficient-history'"
          description="当前数据范围不足：每个目标期至少需要 20 期更早历史，无法执行回测"
        />
        <a-empty v-else description="选择回测期数后点击开始回测" />
      </section>
    </template>

    <a-empty v-else-if="!lottoStore.loading" description="当前数据范围不足以建立相邻转移模型" />

    <a-drawer v-model:visible="evidenceVisible" :width="560" title="相邻转移历史证据" unmount-on-close>
      <template v-if="evidenceCandidate">
        <a-alert
          type="info"
        >
          {{ formatBall(startNumber) }} → {{ formatBall(evidenceCandidate.number) }}：{{ evidenceCandidate.count }} 次，{{ percent(evidenceCandidate.historicalProbability ?? evidenceCandidate.probability) }}
        </a-alert>
        <div v-for="row in evidenceCandidate.evidence" :key="`${row.issue}-${row.index ?? ''}`" class="evidence-row">
          <b>第 {{ row.issue }} 期 · {{ row.openTime }}</b>
          <div class="evidence-sequence">
            <span
              v-for="(number, index) in row.sequence"
              :key="index"
              class="ball"
              :class="isEvidencePair(row.sequence, index, evidenceCandidate.number) ? 'highlight' : 'muted'"
            >{{ formatBall(number) }}</span>
          </div>
        </div>
      </template>
    </a-drawer>
  </a-card>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useLottoStore } from '@/stores/lottoStore'
import HistoricalCollisionStatus from '@/components/HistoricalCollisionStatus.vue'
import {
  backtestTransitionModel,
  buildTransitionModel,
  generateBeamChains,
  generateGreedyChain,
  getNextNumberDistribution
} from '@/utils/transitionAnalysis'
import { checkHistoricalCollision } from '@/utils/historicalCollision'

const lottoStore = useLottoStore()
const startNumber = ref(5)
const mode = ref('classic')
const windowChoice = ref('all')
const customWindow = ref(365)
const horizonChoice = ref('50')
const customHorizon = ref(50)
const model = ref(null)
const distribution = ref(null)
const greedy = ref(null)
const beamChains = ref([])
const backtest = ref(null)
const analyzing = ref(false)
const backtesting = ref(false)
const errorMessage = ref('')
const showAllCandidates = ref(false)
const evidenceVisible = ref(false)
const evidenceCandidate = ref(null)

const activeRecords = computed(() => lottoStore.transitionData || [])
const visibleCandidates = computed(() => showAllCandidates.value
  ? (distribution.value?.candidates || [])
  : (distribution.value?.candidates || []).slice(0, 10))

const trainingWindow = computed(() => {
  if (windowChoice.value === 'all') return null
  if (windowChoice.value === 'custom') return customWindow.value
  return Number(windowChoice.value)
})

const attachCollision = (chain) => ({
  ...chain,
  collision: checkHistoricalCollision(lottoStore.collisionIndex, { redBalls: chain.sortedBalls })
})

const refreshAnalysis = () => {
  if (!activeRecords.value.length || !lottoStore.collisionIndex) {
    model.value = null
    return
  }
  try {
    analyzing.value = true
    errorMessage.value = ''
    model.value = buildTransitionModel(activeRecords.value, {
      mode: mode.value,
      trainingWindow: trainingWindow.value
    })
    distribution.value = getNextNumberDistribution(model.value, [startNumber.value], { mode: mode.value })
    greedy.value = attachCollision(generateGreedyChain(model.value, startNumber.value, { mode: mode.value }))
    const beam = generateBeamChains(model.value, startNumber.value, { mode: mode.value, beamWidth: 8, expansionWidth: 8 })
    beamChains.value = (beam.chains || []).slice(0, 3).map(attachCollision)
    backtest.value = null
  } catch (error) {
    console.error('相邻号码分析失败:', error)
    errorMessage.value = error.message || '相邻号码分析失败'
  } finally {
    analyzing.value = false
  }
}

const runBacktest = async () => {
  try {
    if (!activeRecords.value.length || !lottoStore.collisionIndex) {
      throw new Error('历史数据尚未加载完成')
    }
    backtesting.value = true
    errorMessage.value = ''
    await new Promise(resolve => setTimeout(resolve, 0))
    backtest.value = backtestTransitionModel(activeRecords.value, {
      mode: mode.value,
      trainingWindows: [50, 100],
      evaluationHorizon: horizonChoice.value === 'custom' ? customHorizon.value : Number(horizonChoice.value),
      collisionIndex: lottoStore.collisionIndex,
      collisionChecker: checkHistoricalCollision
    })
  } catch (error) {
    console.error('滚动回测失败:', error)
    errorMessage.value = error.message || '滚动回测失败'
  } finally {
    backtesting.value = false
  }
}

const showEvidence = (candidate) => {
  evidenceCandidate.value = candidate
  evidenceVisible.value = true
}

const formatBall = number => String(number).padStart(2, '0')
const formatBalls = numbers => (numbers || []).map(formatBall).join(' ')
const percent = value => `${((Number(value) || 0) * 100).toFixed(2)}%`
const barWidth = candidate => {
  const max = visibleCandidates.value[0]?.historicalProbability ?? visibleCandidates.value[0]?.probability ?? 1
  const value = candidate.historicalProbability ?? candidate.probability ?? 0
  return Math.max(2, (value / max) * 100)
}
const sourceLabel = source => ({
  classic: '经典相邻',
  recent: '近期加权',
  'second-order': '二阶链',
  'first-order-backoff': '一阶回退',
  'global-fallback': '全局频率回退'
}[source] || source)
const getCollisionTargets = result => (result?.targets || []).filter(target => (
  target.collision?.redBallCollision || target.collision?.fullCombinationCollision
))
const isEvidencePair = (sequence, index, target) => (
  (sequence[index] === startNumber.value && sequence[index + 1] === target) ||
  (index > 0 && sequence[index - 1] === startNumber.value && sequence[index] === target)
)

watch(
  [() => lottoStore.filteredData, () => lottoStore.hasActiveFilter, () => lottoStore.collisionIndex],
  refreshAnalysis,
  { deep: true }
)
watch(mode, () => { backtest.value = null })
onMounted(refreshAnalysis)
</script>

<style scoped>
.transition-card { margin-bottom: 16px; }
.title-block { display: flex; flex-direction: column; gap: 3px; }
.title-block small, .section-heading p { color: #86909c; font-weight: 400; margin: 0; }
.disclaimer { margin-bottom: 18px; }
.controls { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 18px; padding: 16px; background: #f7f8fa; border-radius: 10px; }
.controls :deep(.arco-form-item) { margin-bottom: 0; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
.summary-grid :deep(.arco-statistic) { padding: 14px; border: 1px solid #e5e6eb; border-radius: 8px; }
.section { margin-top: 22px; padding: 18px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; }
.section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
.section-heading h3 { margin: 0 0 5px; }
.candidate-list { display: flex; flex-direction: column; gap: 8px; }
.candidate-row { display: grid; grid-template-columns: 28px 36px minmax(80px, 1fr) 70px 65px 75px; align-items: center; gap: 9px; }
.rank { color: #86909c; text-align: center; }
.ball { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; font-size: 12px; font-weight: 700; flex: 0 0 auto; }
.ball.red { color: #fff; background: linear-gradient(135deg, #f53f3f, #ff7d00); }
.ball.start { color: #fff; background: linear-gradient(135deg, #722ed1, #a871e3); }
.ball.large { width: 42px; height: 42px; font-size: 15px; }
.bar-wrap { height: 10px; border-radius: 5px; background: #f2f3f5; overflow: hidden; }
.bar { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #722ed1, #a871e3); }
.count { color: #86909c; }
.chain { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding: 18px; background: #f7f8fa; border-radius: 10px; }
.arrow { color: #86909c; font-size: 20px; }
.sorted-result { display: flex; justify-content: center; align-items: center; gap: 7px; margin: 14px 0; }
.step-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }
.step-card { display: flex; flex-direction: column; gap: 4px; padding: 10px; background: #f7f8fa; border-radius: 8px; font-size: 12px; }
.step-card small { color: #86909c; }
.beam-grid, .comparison-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.beam-card, .window-card { padding: 14px; border: 1px solid #e5e6eb; border-radius: 9px; }
.mini-chain { display: flex; flex-wrap: wrap; gap: 5px; margin: 12px 0; }
.backtest-controls { display: flex; flex-wrap: wrap; gap: 8px; }
.comparison-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px; }
.window-card h4 { margin: 0 0 12px; }
.metric-row { display: grid; grid-template-columns: 1fr 70px 1.5fr; gap: 8px; padding: 6px 0; }
.metric-row small { color: #86909c; text-align: right; }
.match-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.distribution { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 12px 0; color: #4e5969; font-size: 12px; }
.collision-targets { margin-bottom: 8px; }
.target-row, .evidence-row { display: flex; flex-direction: column; gap: 7px; padding: 10px 0; border-bottom: 1px solid #f2f3f5; }
.evidence-sequence { display: flex; flex-wrap: wrap; gap: 5px; }
.ball.muted { background: #f2f3f5; color: #4e5969; }
.ball.highlight { color: #fff; background: #722ed1; }

@media (max-width: 900px) {
  .summary-grid { grid-template-columns: repeat(2, 1fr); }
  .step-grid, .beam-grid { grid-template-columns: repeat(2, 1fr); }
  .comparison-grid { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .section { padding: 13px; }
  .section-heading { flex-direction: column; }
  .candidate-row { grid-template-columns: 24px 32px 1fr 65px; }
  .candidate-row .count { display: none; }
  .candidate-row :deep(.arco-btn) { grid-column: 3 / 5; justify-self: end; }
  .step-grid, .beam-grid, .match-summary { grid-template-columns: 1fr; }
  .controls { align-items: stretch; }
  .controls :deep(.arco-form-item) { width: 100%; }
}
</style>
