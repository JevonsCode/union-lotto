<script setup>
import { onMounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import {
  CanvasRenderer
} from 'echarts/renderers'
import {
  BarChart,
  LineChart
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent
} from 'echarts/components'
import { useLottoStore } from '@/stores/lottoStore'
import PredictionGenerator from '@/components/PredictionGenerator.vue'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent
])

const lottoStore = useLottoStore()

const columns = [
  {
    title: '期数',
    dataIndex: 'issue',
    width: 100,
    sorter: (a, b) => parseInt(a.issue) - parseInt(b.issue)
  },
  {
    title: '开奖日期',
    dataIndex: 'openTime',
    width: 120,
    sorter: (a, b) => new Date(a.openTime) - new Date(b.openTime)
  },
  {
    title: '红球',
    dataIndex: 'frontWinningNum',
    slotName: 'frontWinningNum',
    width: 200
  },
  {
    title: '蓝球',
    dataIndex: 'backWinningNum',
    slotName: 'backWinningNum',
    width: 80
  },
  {
    title: '销售额',
    dataIndex: 'saleMoney',
    slotName: 'saleMoney',
    width: 120
  },
  {
    title: '奖池金额',
    dataIndex: 'prizePoolMoney',
    slotName: 'prizePoolMoney',
    width: 120,
  },
  {
    title: '星期',
    dataIndex: 'week',
    width: 80
  }
]

const redBallOption = computed(() => {
  const dataToUse = lottoStore.filteredData.length > 0 ? lottoStore.filteredData : lottoStore.data
  if (dataToUse.length === 0) return {}
  
  let redBallStats = lottoStore.getRedBallStats(dataToUse)
  
  // 根据排序方式排序
  if (lottoStore.sortParams.redBallSort === 'count') {
    redBallStats = redBallStats.sort((a, b) => b.count - a.count)
  } else {
    redBallStats = redBallStats.sort((a, b) => a.number - b.number)
  }
  
  return {
    title: { 
      text: `红球号码分布 (1-33) - ${dataToUse.length}期数据`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.8)',
      textStyle: { color: '#fff' },
      formatter: function(params) {
        const data = params[0]
        const item = redBallStats[data.dataIndex]
        return `号码: ${item.number.toString().padStart(2, '0')}<br/>出现次数: ${data.value}<br/>出现率: ${item.percentage}%`
      }
    },
    xAxis: {
      type: 'category',
      data: redBallStats.map(item => item.number.toString().padStart(2, '0')),
      axisLabel: {
        interval: 0,
        rotate: 0,
        fontSize: 10
      },
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: { 
      type: 'value',
      name: '出现次数',
      nameTextStyle: {
        fontSize: 12
      }
    },
    series: [{
      data: redBallStats.map((item, index) => ({
        value: item.count,
        itemStyle: {
          color: item.count === Math.max(...redBallStats.map(s => s.count)) ? '#ff4d4f' : 
                 item.count === Math.min(...redBallStats.map(s => s.count)) ? '#ffa39e' : '#ff7875'
        }
      })),
      type: 'bar',
      barWidth: '60%',
      markLine: {
        data: [{
          type: 'average',
          name: '平均值',
          lineStyle: {
            color: '#722ed1'
          }
        }],
        label: {
          formatter: '平均: {c}'
        }
      }
    }],
    grid: {
      left: 80,
      right: 80,
      bottom: 60,
      top: 60
    }
  }
})

const blueBallOption = computed(() => {
  const dataToUse = lottoStore.filteredData.length > 0 ? lottoStore.filteredData : lottoStore.data
  if (dataToUse.length === 0) return {}
  
  let blueBallStats = lottoStore.getBlueBallStats(dataToUse)
  
  // 根据排序方式排序
  if (lottoStore.sortParams.blueBallSort === 'count') {
    blueBallStats = blueBallStats.sort((a, b) => b.count - a.count)
  } else {
    blueBallStats = blueBallStats.sort((a, b) => a.number - b.number)
  }
  
  return {
    title: { 
      text: `蓝球号码分布 (1-16) - ${dataToUse.length}期数据`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.8)',
      textStyle: { color: '#fff' },
      formatter: function(params) {
        const data = params[0]
        const item = blueBallStats[data.dataIndex]
        return `号码: ${item.number.toString().padStart(2, '0')}<br/>出现次数: ${data.value}<br/>出现率: ${item.percentage}%`
      }
    },
    xAxis: {
      type: 'category',
      data: blueBallStats.map(item => item.number.toString().padStart(2, '0')),
      axisLabel: {
        interval: 0,
        fontSize: 11
      },
      axisTick: {
        alignWithLabel: true
      }
    },
    yAxis: { 
      type: 'value',
      name: '出现次数',
      nameTextStyle: {
        fontSize: 12
      }
    },
    series: [{
      data: blueBallStats.map((item, index) => ({
        value: item.count,
        itemStyle: {
          color: item.count === Math.max(...blueBallStats.map(s => s.count)) ? '#1890ff' : 
                 item.count === Math.min(...blueBallStats.map(s => s.count)) ? '#91d5ff' : '#40a9ff'
        }
      })),
      type: 'bar',
      barWidth: '70%',
      markLine: {
        data: [{
          type: 'average',
          name: '平均值',
          lineStyle: {
            color: '#722ed1'
          }
        }],
        label: {
          formatter: '平均: {c}'
        }
      }
    }],
    grid: {
      left: 80,
      right: 80,
      bottom: 60,
      top: 60
    }
  }
})

const trendOption = computed(() => {
  const dataToUse = lottoStore.filteredData.length > 0 ? lottoStore.filteredData : lottoStore.data
  if (dataToUse.length === 0) return {}
  
  const trendData = lottoStore.getTrendData(100, dataToUse)
  
  return {
    title: { 
      text: `奖池金额趋势 - ${dataToUse.length}期数据`,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(50,50,50,0.8)',
      textStyle: { color: '#fff' },
      formatter: function(params) {
        const data = params[0]
        const amount = data.value
        const formattedAmount = amount === 0 || !amount ? '--' : lottoStore.formatMoney(amount) + '元'
        return `期数: ${data.name}<br/>奖池金额: ${formattedAmount}`
      }
    },
    xAxis: {
      type: 'category',
      data: trendData.map(item => item.issue),
      axisLabel: {
        interval: Math.max(0, Math.floor(trendData.length / 10) - 1),
        fontSize: 10
      }
    },
    yAxis: { 
      type: 'value',
      name: '奖池金额',
      nameTextStyle: {
        fontSize: 12
      },
      axisLabel: {
        formatter: function(value) {
          if (value === 0) return '--'
          return (value / 100000000).toFixed(1) + '亿'
        }
      }
    },
    series: [{
      name: '奖池金额',
      data: trendData.map(item => item.prizePool),
      type: 'line',
      smooth: true,
      lineStyle: {
        color: '#52c41a',
        width: 2
      },
      itemStyle: { 
        color: '#52c41a',
        borderColor: '#fff',
        borderWidth: 2
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [{
            offset: 0, color: 'rgba(82, 196, 26, 0.4)'
          }, {
            offset: 1, color: 'rgba(82, 196, 26, 0.1)'
          }]
        }
      },
      markPoint: {
        data: [
          {type: 'max', name: '最大值'},
          {type: 'min', name: '最小值'}
        ]
      }
    }],
    grid: {
      left: 80,
      right: 80,
      bottom: 60,
      top: 60
    }
  }
})

// 格式化统计值
const formatStatisticValue = (value) => {
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  } else if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  }
  return value.toLocaleString()
}

// 事件处理
const handlePageChange = (page) => {
  lottoStore.pagination.current = page
}

const handlePageSizeChange = (pageSize) => {
  lottoStore.pagination.pageSize = pageSize
  lottoStore.pagination.current = 1
}


onMounted(() => {
  lottoStore.loadData()
})
</script>

<template>
  <div id="app">
    <a-layout class="layout">
      <a-layout-header class="header">
      </a-layout-header>
      
      <a-layout-content class="content">
        <div class="container">

          <!-- 预测生成组件 -->
          <PredictionGenerator />

          <!-- 搜索和筛选区域 -->
          <a-card title="数据查询" class="search-card" style="margin-bottom: 16px;">
            <a-row :gutter="16" align="middle">
              <a-col :span="5">
                <div style="margin-bottom: 8px; font-weight: 500;">开始期数</div>
                <a-select 
                  v-model="lottoStore.searchParams.startIssue" 
                  placeholder="请选择开始期数"
                  :options="lottoStore.getIssueList()"
                  allow-clear
                  show-search
                  :filter-option="(input, option) => option.label.includes(input)"
                  style="width: 100%;"
                />
              </a-col>
              <a-col :span="5">
                <div style="margin-bottom: 8px; font-weight: 500;">结束期数</div>
                <a-select 
                  v-model="lottoStore.searchParams.endIssue" 
                  placeholder="请选择结束期数"
                  :options="lottoStore.getIssueList()"
                  allow-clear
                  show-search
                  :filter-option="(input, option) => option.label.includes(input)"
                  style="width: 100%;"
                />
              </a-col>
              <a-col :span="14">
                <div style="margin-bottom: 8px;">&nbsp;</div>
                <a-button type="primary" @click="lottoStore.handleSearch">查询</a-button>
                <a-button style="margin-left: 8px;" @click="lottoStore.handleReset">重置</a-button>
              </a-col>
            </a-row>
          </a-card>


          <!-- 统计卡片 -->
          <a-row :gutter="16" style="margin-bottom: 16px;">
            <a-col>
              <a-card>
                <a-statistic title="总期数" :value="lottoStore.statistics.totalIssues" />
              </a-card>
            </a-col>
            <!-- <a-col :span="6">
              <a-card>
                <a-statistic 
                  title="最高奖池" 
                  :value="lottoStore.statistics.maxPrizePool" 
                  :formatter="formatStatisticValue"
                  suffix="元" 
                />
              </a-card>
            </a-col>
            <a-col :span="6">
              <a-card>
                <a-statistic 
                  title="最高销售额" 
                  :value="lottoStore.statistics.maxSaleMoney" 
                  :formatter="formatStatisticValue"
                  suffix="元" 
                />
              </a-card>
            </a-col>
            <a-col :span="6">
              <a-card>
                <a-statistic 
                  title="平均奖池" 
                  :value="lottoStore.statistics.avgPrizePool" 
                  :formatter="formatStatisticValue"
                  suffix="元" 
                />
              </a-card>
            </a-col> -->
          </a-row>

          <!-- 数据表格 -->
          <a-card title="开奖数据" style="margin-bottom: 16px;">
            <a-table 
              :columns="columns" 
              :data="lottoStore.paginatedData" 
              :pagination="lottoStore.pagination"
              :loading="lottoStore.loading"
              @page-change="handlePageChange"
              @page-size-change="handlePageSizeChange"
            >
              <template #frontWinningNum="{ record }">
                <div class="number-display">
                  <span 
                    v-for="num in record.frontWinningNum.split(' ')" 
                    :key="num"
                    class="red-ball"
                  >
                    {{ num }}
                  </span>
                </div>
              </template>
              <template #backWinningNum="{ record }">
                <div class="number-display">
                  <span class="blue-ball">{{ record.backWinningNum }}</span>
                </div>
              </template>
              <template #saleMoney="{ record }">
                {{ lottoStore.formatMoney(record.saleMoney) }}
              </template>
              <template #prizePoolMoney="{ record }">
                {{ lottoStore.formatMoney(record.prizePoolMoney) }}
              </template>
            </a-table>
          </a-card>

          <!-- 号码分布图表区域 -->
          <a-row :gutter="16" style="margin-bottom: 16px;">
            <a-col :span="24">
              <a-card :loading="lottoStore.loading" class="chart-container">
                <template #title>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>红球号码分布统计 (1-33)</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <a-select 
                        v-model="lottoStore.sortParams.redBallSort" 
                        style="width: 120px;"
                        size="small"
                      >
                        <a-option value="number">按号码排序</a-option>
                        <a-option value="count">按次数排序</a-option>
                      </a-select>
                      <a-button @click="lottoStore.loadData" type="dashed" size="small">重新加载</a-button>
                    </div>
                  </div>
                </template>
                <VChart 
                  :option="redBallOption" 
                  style="height: 450px; width: 100%;" 
                  autoresize
                />
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="16" style="margin-bottom: 16px;">
            <a-col :span="24">
              <a-card :loading="lottoStore.loading" class="chart-container">
                <template #title>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>蓝球号码分布统计 (1-16)</span>
                    <a-select 
                      v-model="lottoStore.sortParams.blueBallSort" 
                      style="width: 120px;"
                      size="small"
                    >
                      <a-option value="number">按号码排序</a-option>
                      <a-option value="count">按次数排序</a-option>
                    </a-select>
                  </div>
                </template>
                <VChart 
                  :option="blueBallOption" 
                  style="height: 350px; width: 100%;" 
                  autoresize
                />
              </a-card>
            </a-col>
          </a-row>

          <!-- 奖池趋势图 -->
          <a-row>
            <a-col :span="24">
              <a-card title="奖池金额趋势" :loading="lottoStore.loading" class="chart-container">
                <VChart 
                  :option="trendOption" 
                  style="height: 400px; width: 100%;" 
                  autoresize
                />
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-layout-content>
    </a-layout>
  </div>
</template>
