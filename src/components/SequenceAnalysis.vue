<template>
  <a-card title="开奖顺序概率分析" class="sequence-analysis-card">
    <template #extra>
      <a-button type="primary" @click="analyzeSequence" :loading="analyzing">
        分析
      </a-button>
    </template>
    
    <div v-if="sequenceAnalysis.length > 0" class="analysis-content">
      <div class="analysis-grid">
        <div 
          v-for="(analysis, index) in sequenceAnalysis" 
          :key="index"
          class="analysis-item"
        >
          <div class="number-header">
            <span class="number-ball">{{ analysis.number.toString().padStart(2, '0') }}</span>
            <span class="number-label">号球</span>
          </div>
          <div class="probability-list">
            <div 
              v-for="(prob, probIndex) in analysis.topProbabilities" 
              :key="probIndex"
              class="probability-item"
              :class="{ 'top-probability': probIndex === 0 }"
            >
              <span class="prob-ball">{{ prob.number.toString().padStart(2, '0') }}</span>
              <span class="prob-percentage">{{ prob.percentage }}%</span>
              <span class="prob-count">({{ prob.count }}次)</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="analysis-summary">
        <a-divider>分析说明</a-divider>
        <p>基于历史开奖数据，分析每个红球号码（1-33）在开奖顺序中后面最常出现的号码及其概率。</p>
        <p>数据来源：{{ analysisDataCount }}期开奖记录</p>
      </div>
    </div>
    
    <div v-else class="empty-analysis">
      <a-empty description="点击分析按钮开始分析开奖顺序概率" />
    </div>
  </a-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLottoStore } from '@/stores/lottoStore'

const lottoStore = useLottoStore()

const sequenceAnalysis = ref([])
const analyzing = ref(false)
const analysisDataCount = ref(0)

const analyzeSequence = async () => {
  try {
    analyzing.value = true
    
    // 模拟分析时间
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const dataToUse = lottoStore.filteredData.length > 0 
      ? lottoStore.filteredData 
      : lottoStore.data
    
    if (dataToUse.length === 0) {
      throw new Error('没有可分析的数据')
    }
    
    analysisDataCount.value = dataToUse.length
    
    // 分析每个号码（1-33）后面最常出现的号码
    const analysis = []
    
    for (let currentNumber = 1; currentNumber <= 33; currentNumber++) {
      const nextNumberStats = {}
      
      // 初始化1-33的统计
      for (let i = 1; i <= 33; i++) {
        nextNumberStats[i] = 0
      }
      
      // 统计当前号码后面出现的号码
      dataToUse.forEach(item => {
        if (item.seqFrontWinningNum) {
          const sequenceNumbers = item.seqFrontWinningNum.split(' ')
          
          // 找到当前号码在序列中的位置
          const currentIndex = sequenceNumbers.findIndex(num => parseInt(num) === currentNumber)
          
          // 如果找到了当前号码，且不是最后一个位置
          if (currentIndex !== -1 && currentIndex < sequenceNumbers.length - 1) {
            const nextNumber = parseInt(sequenceNumbers[currentIndex + 1])
            if (nextNumber >= 1 && nextNumber <= 33) {
              nextNumberStats[nextNumber]++
            }
          }
        }
      })
      
      // 转换为数组并排序
      const sortedStats = Object.entries(nextNumberStats)
        .map(([number, count]) => ({
          number: parseInt(number),
          count,
          percentage: ((count / dataToUse.length) * 100).toFixed(2)
        }))
        .sort((a, b) => b.count - a.count)
      
      // 取前3个最可能的号码
      const topProbabilities = sortedStats.slice(0, 3)
      
      analysis.push({
        number: currentNumber,
        topProbabilities,
        totalCount: dataToUse.length
      })
    }
    
    sequenceAnalysis.value = analysis
    
  } catch (error) {
    console.error('分析失败:', error)
  } finally {
    analyzing.value = false
  }
}
</script>

<style scoped>
.sequence-analysis-card {
  margin-bottom: 16px;
}

.analysis-content {
  margin-top: 16px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.analysis-item {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  background-color: #fafafa;
}

.number-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.number-label {
  font-weight: bold;
  font-size: 14px;
  color: #1890ff;
}

.number-ball {
  display: inline-block;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 12px;
}

.probability-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.probability-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background-color: white;
  border: 1px solid #f0f0f0;
}

.probability-item.top-probability {
  background-color: #f6ffed;
  border-color: #b7eb8f;
}

.prob-ball {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 10px;
}

.prob-percentage {
  font-weight: bold;
  color: #1890ff;
  min-width: 40px;
}

.prob-count {
  color: #666;
  font-size: 12px;
}

.analysis-summary {
  margin-top: 16px;
  padding: 16px;
  background-color: #f6ffed;
  border-radius: 6px;
  border: 1px solid #b7eb8f;
}

.analysis-summary p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.empty-analysis {
  text-align: center;
  padding: 40px 0;
}
</style>
