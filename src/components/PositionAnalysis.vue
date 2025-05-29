<template>
  <a-card title="位置分析预测" class="position-analysis-card">
    <template #extra>
      <a-button type="primary" @click="startAnalysis" :loading="analyzing">
        开始分析
      </a-button>
    </template>
    
    <!-- 参数设置 -->
    <div class="analysis-params">
      <a-alert 
        message="参数说明" 
        :description="`数据范围：第${issueRange.min}期 - 第${issueRange.max}期，共${issueRange.max - issueRange.min + 1}期。默认设置：训练数据使用第${issueRange.min}期到第${issueRange.max - 1}期，测试数据从第${issueRange.max}期开始。`"
        type="info" 
        show-icon 
        style="margin-bottom: 16px;"
        v-if="issueRange.min && issueRange.max"
      />
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="训练数据区间开始期数">
            <a-input 
              v-model="lottoStore.analysisParams.trainingStartIssue"
              placeholder="如：2003001"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="训练数据区间结束期数">
            <a-input 
              v-model="lottoStore.analysisParams.trainingEndIssue"
              placeholder="如：2025058"
              allow-clear
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="预测期数">
            <a-input-number 
              v-model="lottoStore.analysisParams.predictionCount"
              :min="1"
              :max="100"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </div>

    <!-- 分析结果 -->
    <div v-if="analysisResult" class="analysis-results">
      <a-divider>分析结果</a-divider>
      
      <!-- 基本信息 -->
      <a-row :gutter="16" style="margin-bottom: 16px;">
        <a-col :span="6">
          <a-statistic 
            title="训练数据量" 
            :value="analysisResult.trainingDataSize" 
            suffix="期"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic 
            title="测试数据量" 
            :value="analysisResult.testDataSize" 
            suffix="期"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic 
            title="平均红球命中" 
            :value="analysisResult.validation.avgRedMatches" 
            suffix="个"
          />
        </a-col>
        <a-col :span="6">
          <a-statistic 
            title="总体准确率" 
            :value="analysisResult.validation.accuracy.overall" 
            suffix="%"
          />
        </a-col>
      </a-row>

      <!-- 收益分析 -->
      <a-card title="收益分析" size="small" style="margin-bottom: 16px;">
        <a-row :gutter="16">
          <a-col :span="6">
            <a-statistic 
              title="总投入" 
              :value="analysisResult.roiAnalysis.totalCost" 
              suffix="元"
              :value-style="{ color: '#cf1322' }"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic 
              title="总收入" 
              :value="analysisResult.roiAnalysis.totalWinnings" 
              suffix="元"
              :value-style="{ color: '#3f8600' }"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic 
              title="净收益" 
              :value="analysisResult.roiAnalysis.netProfit" 
              suffix="元"
              :value-style="{ 
                color: analysisResult.roiAnalysis.netProfit >= 0 ? '#3f8600' : '#cf1322' 
              }"
            />
          </a-col>
          <a-col :span="6">
            <a-statistic 
              title="投资回报率" 
              :value="analysisResult.roiAnalysis.roi" 
              suffix="%"
              :value-style="{ 
                color: analysisResult.roiAnalysis.roi >= 0 ? '#3f8600' : '#cf1322' 
              }"
            />
          </a-col>
        </a-row>
        
        <!-- 中奖明细 -->
        <div v-if="Object.keys(analysisResult.roiAnalysis.winBreakdown).length > 0" style="margin-top: 16px;">
          <a-divider size="small">中奖明细</a-divider>
          <a-space wrap>
            <a-tag 
              v-for="(count, prize) in analysisResult.roiAnalysis.winBreakdown" 
              :key="prize"
              color="blue"
            >
              {{ prize }}: {{ count }}次
            </a-tag>
          </a-space>
        </div>
      </a-card>

      <!-- 命中率分析 -->
      <a-card title="命中率分析" size="small" style="margin-bottom: 16px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <h4>红球命中分布</h4>
            <a-space direction="vertical" style="width: 100%;">
              <div v-for="(count, matches) in analysisResult.validation.redBallMatches" :key="matches">
                <span>命中{{ matches }}个: </span>
                <a-progress 
                  :percent="count / analysisResult.validation.totalPredictions * 100" 
                  :format="() => `${count}次`"
                  size="small"
                />
              </div>
            </a-space>
          </a-col>
          <a-col :span="12">
            <h4>蓝球命中情况</h4>
            <a-statistic 
              title="蓝球命中次数" 
              :value="analysisResult.validation.blueBallMatches" 
              :suffix="`/ ${analysisResult.validation.totalPredictions}`"
            />
            <a-progress 
              :percent="analysisResult.validation.accuracy.blue" 
              :format="(percent) => `${percent}%`"
            />
          </a-col>
        </a-row>
      </a-card>

      <!-- 预测对比 -->
      <a-card title="预测结果对比" size="small">
        <a-table 
          :data="comparisonData" 
          :columns="comparisonColumns"
          :pagination="{ pageSize: 10 }"
          size="small"
        >
          <template #prediction="{ record }">
            <div class="number-display">
              <span 
                v-for="num in record.prediction.frontWinningNum.split(' ')" 
                :key="num"
                class="red-ball small"
              >
                {{ num }}
              </span>
              <span class="blue-ball small">{{ record.prediction.backWinningNum }}</span>
            </div>
          </template>
          
          <template #actual="{ record }">
            <div v-if="record.actual" class="number-display">
              <span 
                v-for="num in record.actual.frontWinningNum.split(' ')" 
                :key="num"
                class="red-ball small"
              >
                {{ num }}
              </span>
              <span class="blue-ball small">{{ record.actual.backWinningNum }}</span>
            </div>
            <span v-else style="color: #999;">暂无开奖</span>
          </template>
          
          <template #matches="{ record }">
            <a-space>
              <a-tag color="red">红{{ record.redMatches }}</a-tag>
              <a-tag color="blue" v-if="record.blueMatch">蓝√</a-tag>
              <a-tag v-else>蓝×</a-tag>
            </a-space>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <a-empty description="设置参数并点击开始分析">
        <template #image>
          <icon-analysis />
        </template>
      </a-empty>
    </div>
  </a-card>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLottoStore } from '@/stores/lottoStore'

const lottoStore = useLottoStore()
const analyzing = ref(false)
const analysisResult = ref(null)

/**
 * 期数范围信息
 */
const issueRange = computed(() => {
  return lottoStore.getIssueRange()
})

/**
 * 对比数据
 */
const comparisonData = computed(() => {
  if (!analysisResult.value) return []
  
  return analysisResult.value.predictions.map((prediction, index) => {
    const actual = analysisResult.value.testData[index]
    let redMatches = 0
    let blueMatch = false
    
    if (actual) {
      const predRedBalls = prediction.frontWinningNum.split(' ').map(n => parseInt(n))
      const actualRedBalls = actual.frontWinningNum.split(' ').map(n => parseInt(n))
      redMatches = predRedBalls.filter(num => actualRedBalls.includes(num)).length
      blueMatch = parseInt(prediction.backWinningNum) === parseInt(actual.backWinningNum)
    }
    
    return {
      index: index + 1,
      prediction,
      actual,
      redMatches,
      blueMatch
    }
  })
})

/**
 * 对比表格列定义
 */
const comparisonColumns = [
  {
    title: '序号',
    dataIndex: 'index',
    width: 60
  },
  {
    title: '预测号码',
    slotName: 'prediction',
    width: 200
  },
  {
    title: '实际开奖',
    slotName: 'actual',
    width: 200
  },
  {
    title: '命中情况',
    slotName: 'matches',
    width: 120
  },
  {
    title: '期号',
    dataIndex: 'actual.issue',
    width: 100,
    render: ({ record }) => record.actual?.issue || '--'
  }
]

/**
 * 开始分析
 */
const startAnalysis = async () => {
  try {
    analyzing.value = true
    
    if (!lottoStore.analysisParams.trainingStartIssue || !lottoStore.analysisParams.trainingEndIssue) {
      throw new Error('请设置训练数据区间')
    }
    
    // 执行分析
    const result = await lottoStore.performPositionAnalysis()
    analysisResult.value = result
    
  } catch (error) {
    console.error('分析失败:', error)
    // 这里可以添加错误提示
  } finally {
    analyzing.value = false
  }
}
</script>

<style scoped>
.position-analysis-card {
  margin-bottom: 16px;
}

.analysis-params {
  padding: 16px;
  background-color: #fafafa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.analysis-results {
  margin-top: 16px;
}

.number-display {
  display: flex;
  gap: 4px;
  align-items: center;
}

.red-ball.small,
.blue-ball.small {
  width: 20px;
  height: 20px;
  line-height: 20px;
  font-size: 10px;
}

.empty-state {
  text-align: center;
  padding: 60px 0;
}
</style> 