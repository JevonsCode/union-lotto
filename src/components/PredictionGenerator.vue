<template>
  <a-card title="号码预测生成" class="prediction-card">
    <template #extra>
      <a-button type="primary" @click="generateNewPrediction" :loading="generating">
        生成
      </a-button>
    </template>
    
    <div v-if="prediction" class="prediction-content">
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
            <span class="time">{{ item.time }}</span>
          </div>
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

const lottoStore = useLottoStore()

const prediction = ref(null)
const generating = ref(false)
const predictionHistory = ref([])

const generateNewPrediction = async () => {
  try {
    generating.value = true
    
    // 模拟生成时间
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const newPrediction = lottoStore.generatePrediction()
    prediction.value = newPrediction
    
    // 添加到历史记录
    const historyItem = {
      ...newPrediction,
      time: new Date().toLocaleString('zh-CN')
    }
    
    predictionHistory.value.unshift(historyItem)
    
    // 最多保留10条记录
    if (predictionHistory.value.length > 10) {
      predictionHistory.value = predictionHistory.value.slice(0, 10)
    }
    
  } catch (error) {
    console.error('生成预测失败:', error)
  } finally {
    generating.value = false
  }
}

const clearHistory = () => {
  predictionHistory.value = []
}
</script>

<style scoped>
.prediction-card {
  margin-bottom: 16px;
}

.prediction-content {
  text-align: center;
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
  margin-top: 20px;
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
  justify-content: space-between;
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

.time {
  font-size: 12px;
  color: #999;
}
</style> 