<template>
  <a-card title="号码预测生成" class="prediction-card">
    <template #extra>
      <a-select
        v-model="generationRule"
        style="width: 140px; margin-right: 8px"
        size="small"
      >
        <a-option value="random">随机生成</a-option>
        <a-option value="probability">概率生成</a-option>
        <a-option value="sequence">序列概率生成</a-option>
      </a-select>
      <a-input-number
        v-if="generationRule === 'sequence'"
        v-model="sequenceStartNumber"
        :min="1"
        :max="33"
        size="small"
        style="width: 78px; margin-right: 8px"
        placeholder="起点"
      />
      <a-select
        v-if="generationRule === 'sequence'"
        v-model="sequenceMode"
        size="small"
        style="width: 112px; margin-right: 8px"
      >
        <a-option value="classic">经典相邻</a-option>
        <a-option value="recent">近期加权</a-option>
        <a-option value="second-order">二阶链</a-option>
      </a-select>
      <a-select
        v-if="generationRule === 'sequence'"
        v-model="sequenceWindow"
        size="small"
        style="width: 112px; margin-right: 8px"
      >
        <a-option value="all">全部历史</a-option>
        <a-option value="50">最近50期</a-option>
        <a-option value="100">最近100期</a-option>
      </a-select>
      <a-button
        type="primary"
        @click="generateNewPrediction"
        :loading="generating || lottoStore.loading"
        :disabled="!lottoStore.loaded"
      >
        生成
      </a-button>
    </template>
    
    <a-alert v-if="errorMessage" type="error" show-icon class="prediction-error">{{ errorMessage }}</a-alert>

    <div v-if="prediction" class="prediction-content">
      <div class="prediction-info">
        <div class="rule-info">
          <a-tag :color="getRuleColor(generationRule)">
            {{ getRuleLabel(generationRule) }}
          </a-tag>
          <a-tag v-if="prediction.collision?.fullCombinationCollision" color="red">完整历史碰撞</a-tag>
          <a-tag v-else-if="prediction.collision?.redBallCollision" color="orange">红球历史碰撞</a-tag>
          <a-tag v-else color="green">未碰撞</a-tag>
        </div>
      </div>
      
      <div class="number-display">
        <div class="red-balls">
          <span 
            v-for="num in prediction.frontWinningNum.split(' ')" 
            :key="num"
            class="red-ball"
          >
            {{ num }}
          </span>
        </div>
        
        <div class="blue-balls">
          <span class="blue-ball">{{ prediction.backWinningNum }}</span>
        </div>
      </div>
      
      <HistoricalCollisionStatus
        v-if="prediction.collision"
        :collision="prediction.collision"
      />
      
      <div v-if="prediction.generationNotes && prediction.generationNotes.length > 0" class="generation-notes">
        <a-divider>生成说明</a-divider>
        <div class="notes-list">
          <div 
            v-for="(note, index) in prediction.generationNotes" 
            :key="index"
            class="note-item"
          >
            <span class="note-text">{{ note }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <a-empty description="点击生成预测按钮开始预测" />
    </div>

    <div class="prediction-history" v-if="predictionHistory.length > 0">
      <a-divider>最近生成记录</a-divider>
      <div class="history-list">
        <div 
          v-for="(item, index) in predictionHistory" 
          :key="index"
          class="history-item"
        >
          <div class="history-numbers">
            <span 
              v-for="num in item.frontWinningNum.split(' ')" 
              :key="num"
              class="red-ball small"
            >
              {{ num }}
            </span>
            <span class="blue-ball small">{{ item.backWinningNum }}</span>
          </div>
          <div class="history-meta">
            <div class="history-tags">
              <a-tag size="small" :color="getRuleColor(item.rule)">
                {{ getRuleLabel(item.rule) }}
              </a-tag>
              <a-tag v-if="item.collision?.fullCombinationCollision" size="small" color="red">完整碰撞</a-tag>
              <a-tag v-else-if="item.collision?.redBallCollision" size="small" color="orange">红球碰撞</a-tag>
            </div>
            <span class="time">{{ item.time }}</span>
          </div>
          <HistoricalCollisionStatus
            v-if="item.collision"
            :collision="item.collision"
            compact
          />
        </div>
      </div>
      <a-button 
        v-if="predictionHistory.length > 0" 
        type="text" 
        size="small" 
        @click="clearHistory"
      >
        清空记录
      </a-button>
    </div>
  </a-card>
</template>

<script setup>
import { ref } from 'vue'
import { useLottoStore } from '@/stores/lottoStore'
import HistoricalCollisionStatus from '@/components/HistoricalCollisionStatus.vue'

const lottoStore = useLottoStore()

const prediction = ref(null)
const generating = ref(false)
const predictionHistory = ref([])
const generationRule = ref('random')
const sequenceStartNumber = ref(5)
const sequenceMode = ref('classic')
const sequenceWindow = ref('all')
const errorMessage = ref('')

const generateNewPrediction = async () => {
  try {
    generating.value = true
    errorMessage.value = ''
    
    // 模拟生成时间
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newPrediction = lottoStore.generatePrediction(
      generationRule.value,
      generationRule.value === 'sequence'
        ? {
            startNumber: sequenceStartNumber.value,
            mode: sequenceMode.value,
            trainingWindow: sequenceWindow.value === 'all' ? null : Number(sequenceWindow.value)
          }
        : {}
    )
    prediction.value = newPrediction
    
    // 添加到历史记录
    const historyItem = {
      ...newPrediction,
      rule: generationRule.value,
      time: new Date().toLocaleString('zh-CN')
    }
    
    predictionHistory.value.unshift(historyItem)
    
    // 最多保留10条记录
    if (predictionHistory.value.length > 10) {
      predictionHistory.value = predictionHistory.value.slice(0, 10)
    }
    
  } catch (error) {
    console.error('生成预测失败:', error)
    errorMessage.value = error.message || '生成预测失败'
  } finally {
    generating.value = false
  }
}

const clearHistory = () => {
  predictionHistory.value = []
}

const getRuleColor = (rule) => {
  switch (rule) {
    case 'random': return 'blue'
    case 'probability': return 'green'
    case 'sequence': return 'purple'
    default: return 'blue'
  }
}

const getRuleLabel = (rule) => {
  switch (rule) {
    case 'random': return '随机生成'
    case 'probability': return '概率生成'
    case 'sequence': return '序列概率生成'
    default: return '随机生成'
  }
}
</script>

<style scoped>
.prediction-card {
  margin-bottom: 16px;
}

.prediction-content {
  text-align: center;
}

.prediction-error {
  margin-bottom: 16px;
}

.prediction-header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.prediction-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
}

.number-display {
  margin: 20px 0;
}

.red-balls, .blue-balls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
}

.blue-balls {
  margin-left: 8px;
}

.ball-label {
  font-size: 16px;
  font-weight: bold;
  color: #666;
}

.red-ball {
  display: inline-block;
  width: 36px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.3);
}

.red-ball.small {
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-size: 11px;
}

.blue-ball {
  display: inline-block;
  width: 36px;
  height: 36px;
  line-height: 36px;
  text-align: center;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
}

.blue-ball.small {
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-size: 11px;
}

.prediction-info {
  margin-bottom: 16px;
}

.rule-info {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.generation-notes {
  margin-top: 16px;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-item {
  padding: 8px 12px;
  background-color: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;
}

.note-text {
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.empty-state {
  text-align: center;
  padding: 40px 0;
}

.prediction-history {
  margin-top: 24px;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  margin-bottom: 8px;
  background-color: #fafafa;
}

.history-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

.history-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.history-tags {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.time {
  font-size: 12px;
  color: #999;
}
</style>
