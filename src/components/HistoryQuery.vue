<template>
  <a-card title="历史开奖查询" class="history-query-card">
    <template #extra>
      <a-button type="primary" @click="handleSearch" :loading="searching">
        查询
      </a-button>
    </template>
    
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :span="8">
        <div style="margin-bottom: 8px; font-weight: 500">期数</div>
        <a-input
          v-model="searchIssue"
          placeholder="请输入期数"
          allow-clear
        />
      </a-col>
      <a-col :span="8">
        <div style="margin-bottom: 8px; font-weight: 500">红球号码</div>
        <a-input
          v-model="searchRedBalls"
          placeholder="请输入红球号码，用空格分隔"
          allow-clear
        />
      </a-col>
      <a-col :span="8">
        <div style="margin-bottom: 8px; font-weight: 500">蓝球号码</div>
        <a-input
          v-model="searchBlueBall"
          placeholder="请输入蓝球号码"
          allow-clear
        />
      </a-col>
    </a-row>

    <div v-if="searchResults.length > 0" class="search-results">
      <a-divider>查询结果 ({{ searchResults.length }}条)</a-divider>
      <div class="results-list">
        <div 
          v-for="(item, index) in searchResults" 
          :key="index"
          class="result-item"
        >
          <div class="result-header">
            <span class="issue">第{{ item.issue }}期</span>
            <span class="date">{{ item.openTime }}</span>
          </div>
          <div class="result-numbers">
            <div class="red-balls">
              <span 
                v-for="(num, idx) in item.frontWinningNum.split(' ')" 
                :key="idx"
                class="red-ball"
              >
                {{ num }}
              </span>
            </div>
            <div class="blue-balls">
              <span class="blue-ball">{{ item.backWinningNum }}</span>
            </div>
          </div>
          <div v-if="item.seqFrontWinningNum" class="sequence-info">
            <span class="sequence-label">开奖顺序：</span>
            <span 
              v-for="(num, idx) in item.seqFrontWinningNum.split(' ')" 
              :key="idx"
              class="sequence-ball"
            >
              {{ num }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="hasSearched" class="empty-results">
      <a-empty description="未找到匹配的开奖记录" />
    </div>
  </a-card>
</template>

<script setup>
import { ref } from 'vue'
import { useLottoStore } from '@/stores/lottoStore'

const lottoStore = useLottoStore()

const searchIssue = ref('')
const searchRedBalls = ref('')
const searchBlueBall = ref('')
const searchResults = ref([])
const searching = ref(false)
const hasSearched = ref(false)

const handleSearch = () => {
  searching.value = true
  hasSearched.value = true
  
  try {
    let results = [...lottoStore.data]
    
    // 按期数搜索
    if (searchIssue.value.trim()) {
      results = results.filter(item => 
        item.issue.includes(searchIssue.value.trim())
      )
    }
    
    // 按红球搜索
    if (searchRedBalls.value.trim()) {
      const searchNumbers = searchRedBalls.value.trim().split(/\s+/).map(n => n.padStart(2, '0'))
      results = results.filter(item => {
        const itemNumbers = item.frontWinningNum.split(' ')
        return searchNumbers.every(searchNum => 
          itemNumbers.includes(searchNum)
        )
      })
    }
    
    // 按蓝球搜索
    if (searchBlueBall.value.trim()) {
      const searchBlue = searchBlueBall.value.trim().padStart(2, '0')
      results = results.filter(item => 
        item.backWinningNum === searchBlue
      )
    }
    
    searchResults.value = results.slice(0, 50) // 限制显示50条
    
  } catch (error) {
    console.error('搜索失败:', error)
  } finally {
    searching.value = false
  }
}
</script>

<style scoped>
.history-query-card {
  margin-bottom: 16px;
}

.search-results {
  margin-top: 16px;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  background-color: #fafafa;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.issue {
  font-weight: bold;
  font-size: 16px;
  color: #1890ff;
}

.date {
  color: #666;
  font-size: 14px;
}

.result-numbers {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.red-balls, .blue-balls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.red-ball {
  display: inline-block;
  width: 32px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  background: linear-gradient(135deg, #ff4d4f, #ff7875);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(255, 77, 79, 0.3);
}

.blue-ball {
  display: inline-block;
  width: 32px;
  height: 32px;
  line-height: 32px;
  text-align: center;
  background: linear-gradient(135deg, #1890ff, #40a9ff);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
}

.sequence-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e8e8e8;
}

.sequence-label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.sequence-ball {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: linear-gradient(135deg, #52c41a, #73d13d);
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 10px;
  box-shadow: 0 1px 3px rgba(82, 196, 26, 0.3);
}

.empty-results {
  text-align: center;
  padding: 40px 0;
}
</style>
