import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  generatePositionBasedPrediction, 
  validatePredictions, 
  calculateROI,
  analyzeRedBallPositions,
  analyzeBlueBallFrequency 
} from '@/utils/predictionUtils'
import {
  buildTransitionModel,
  generateGreedyChain
} from '@/utils/transitionAnalysis'
import {
  buildHistoricalCollisionIndex,
  checkHistoricalCollision
} from '@/utils/historicalCollision'

export const useLottoStore = defineStore('lotto', () => {
  // 状态
  const data = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const filteredData = ref([])
  const hasActiveFilter = ref(false)
  const collisionIndex = ref(null)
  
  // 搜索参数
  const searchParams = ref({
    startIssue: '',
    endIssue: '',
    startDate: null,
    endDate: null
  })
  
  // 排序参数
  const sortParams = ref({
    redBallSort: 'count',
    blueBallSort: 'count'
  })
  
  // 分页参数
  const pagination = ref({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    pageSizeOptions: ['10', '20', '50', '100']
  })

  // 预测分析参数
  const analysisParams = ref({
    trainingStartIssue: '',   // 训练数据区间开始期数
    trainingEndIssue: '',     // 训练数据区间结束期数 
    predictionCount: 20       // 预测期数
  })

  /**
   * 计算属性 - 分页数据
   */
  const paginatedData = computed(() => {
    const start = (pagination.value.current - 1) * pagination.value.pageSize
    const end = start + pagination.value.pageSize
    return filteredData.value.slice(start, end)
  })

  /**
   * 计算属性 - 统计数据
   */
  const statistics = computed(() => {
    const dataToUse = filteredData.value.length > 0 ? filteredData.value : data.value
    return getStatistics(dataToUse)
  })

  /**
   * 计算期数范围
   * @returns {Object} 期数范围信息
   */
  const getIssueRange = () => {
    if (data.value.length === 0) return { min: null, max: null }
    
    const issues = data.value.map(item => parseInt(item.issue)).sort((a, b) => a - b)
    return {
      min: issues[0],
      max: issues[issues.length - 1]
    }
  }

  /**
   * 设置默认分析参数
   */
  const setDefaultAnalysisParams = () => {
    const range = getIssueRange()
    if (range.min && range.max) {
      // 训练数据区间开始期数：第一期
      analysisParams.value.trainingStartIssue = range.min.toString()
      // 训练数据区间结束期数：最近一期的上一期
      analysisParams.value.trainingEndIssue = (range.max - 1).toString()
    }
  }

  /**
   * 获取期数列表（用于下拉选择）
   * @returns {Array} 期数列表
   */
  const getIssueList = () => {
    if (data.value.length === 0) return []
    
    return data.value
      .map(item => ({
        value: item.issue,
        label: item.issue
      }))
      .sort((a, b) => parseInt(b.value) - parseInt(a.value)) // 按期数降序排列
  }

  /**
   * 设置默认搜索参数
   */
  const setDefaultSearchParams = () => {
    const range = getIssueRange()
    if (range.min && range.max) {
      // 默认选择最大期数和最小期数
      searchParams.value.startIssue = range.min.toString()
      searchParams.value.endIssue = range.max.toString()
    }
  }

  /**
   * 加载数据
   * @returns {Promise<Array>} 开奖数据
   */
  const loadData = async () => {
    if (loaded.value) {
      return data.value
    }

    try {
      loading.value = true
      const response = await fetch('./data/lotto-data.json')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      data.value = await response.json()
      loaded.value = true
      
      // 按期数排序（最新的在前）
      data.value.sort((a, b) => parseInt(b.issue) - parseInt(a.issue))
      collisionIndex.value = buildHistoricalCollisionIndex(data.value)
      
      // 更新筛选数据
      filteredData.value = data.value
      pagination.value.total = filteredData.value.length
      
      // 设置默认分析参数
      setDefaultAnalysisParams()
      
      // 设置默认搜索参数
      setDefaultSearchParams()
      
      return data.value
    } catch (error) {
      console.error('加载数据失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 根据条件筛选数据
   * @param {Object} filters - 筛选条件
   * @returns {Array} 筛选后的数据
   */
  const filterData = (filters = {}) => {
    let filtered = [...data.value]
    const fullRange = getIssueRange()
    const requestedStart = filters.startIssue ? parseInt(filters.startIssue) : null
    const requestedEnd = filters.endIssue ? parseInt(filters.endIssue) : null
    const hasIssueSubset = (
      (Number.isInteger(requestedStart) && requestedStart > fullRange.min) ||
      (Number.isInteger(requestedEnd) && requestedEnd < fullRange.max)
    )
    hasActiveFilter.value = hasIssueSubset || Boolean(filters.startDate || filters.endDate)

    // 期数区间筛选
    if (filters.startIssue || filters.endIssue) {
      filtered = filtered.filter(item => {
        const issue = parseInt(item.issue)
        const startIssue = filters.startIssue ? parseInt(filters.startIssue) : 0
        const endIssue = filters.endIssue ? parseInt(filters.endIssue) : Infinity
        return issue >= startIssue && issue <= endIssue
      })
    }

    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(item => {
        const openTime = String(item.openTime || '')
        return (!filters.startDate || openTime >= filters.startDate) &&
          (!filters.endDate || openTime <= filters.endDate)
      })
    }
    
    filteredData.value = filtered
    pagination.value.total = filtered.length
    pagination.value.current = 1
    
    return filtered
  }

  /**
   * 执行搜索
   * @returns {Array} 搜索结果
   */
  const handleSearch = () => {
    const filters = {
      startIssue: searchParams.value.startIssue,
      endIssue: searchParams.value.endIssue,
      startDate: searchParams.value.startDate,
      endDate: searchParams.value.endDate
    }
    
    return filterData(filters)
  }

  /**
   * 重置搜索
   */
  const handleReset = () => {
    searchParams.value.startIssue = ''
    searchParams.value.endIssue = ''
    searchParams.value.startDate = null
    searchParams.value.endDate = null
    
    // 重新设置默认搜索参数
    setDefaultSearchParams()
    
    filteredData.value = data.value
    hasActiveFilter.value = false
    pagination.value.total = filteredData.value.length
    pagination.value.current = 1
  }

  /**
   * 计算红球统计
   * @param {Array} dataToUse - 用于统计的数据
   * @returns {Array} 红球统计结果
   */
  const getRedBallStats = (dataToUse = null) => {
    const targetData = dataToUse || data.value
    const stats = {}
    
    // 初始化 1-33 号球的统计
    for (let i = 1; i <= 33; i++) {
      stats[i] = 0
    }

    targetData.forEach(item => {
      const numbers = item.frontWinningNum.split(' ').map(n => parseInt(n))
      numbers.forEach(num => {
        if (stats[num] !== undefined) {
          stats[num]++
        }
      })
    })

    return Object.entries(stats)
      .map(([number, count]) => ({
        number: parseInt(number),
        count,
        percentage: targetData.length > 0 ? ((count / targetData.length) * 100).toFixed(2) : '0.00'
      }))
  }

  /**
   * 计算蓝球统计
   * @param {Array} dataToUse - 用于统计的数据
   * @returns {Array} 蓝球统计结果
   */
  const getBlueBallStats = (dataToUse = null) => {
    const targetData = dataToUse || data.value
    const stats = {}
    
    // 初始化 1-16 号球的统计
    for (let i = 1; i <= 16; i++) {
      stats[i] = 0
    }

    targetData.forEach(item => {
      const blueNum = parseInt(item.backWinningNum)
      if (stats[blueNum] !== undefined) {
        stats[blueNum]++
      }
    })

    return Object.entries(stats)
      .map(([number, count]) => ({
        number: parseInt(number),
        count,
        percentage: targetData.length > 0 ? ((count / targetData.length) * 100).toFixed(2) : '0.00'
      }))
  }

  /**
   * 获取统计信息
   * @param {Array} dataToUse - 用于统计的数据
   * @returns {Object} 统计信息
   */
  const getStatistics = (dataToUse = null) => {
    const targetData = dataToUse || data.value
    
    if (!targetData.length) {
      return {
        totalIssues: 0,
        maxPrizePool: 0,
        maxSaleMoney: 0,
        avgPrizePool: 0,
        avgSaleMoney: 0
      }
    }
    
    const prizePoolAmounts = targetData.map(item => {
      const amount = parseInt(item.prizePoolMoney) || 0
      return amount
    })
    
    const saleAmounts = targetData.map(item => {
      const amount = parseInt(item.saleMoney) || 0
      return amount
    })

    const maxPrizePool = Math.max(...prizePoolAmounts)
    const maxSaleMoney = Math.max(...saleAmounts)
    const avgPrizePool = Math.round(prizePoolAmounts.reduce((a, b) => a + b, 0) / targetData.length)
    const avgSaleMoney = Math.round(saleAmounts.reduce((a, b) => a + b, 0) / targetData.length)

    return {
      totalIssues: targetData.length,
      maxPrizePool,
      maxSaleMoney,
      avgPrizePool,
      avgSaleMoney
    }
  }

  /**
   * 获取趋势数据
   * @param {Number} limit - 限制数量
   * @param {Array} dataToUse - 用于统计的数据
   * @returns {Array} 趋势数据
   */
  const getTrendData = (limit = 50, dataToUse = null) => {
    const targetData = dataToUse || data.value
    return targetData
      .slice(0, limit)
      .reverse()
      .map(item => ({
        issue: item.issue,
        openTime: item.openTime,
        prizePool: parseInt(item.prizePoolMoney) || 0,
        saleMoney: parseInt(item.saleMoney) || 0
      }))
  }

  /**
   * 格式化金额
   * @param {Number} amount - 金额
   * @returns {String} 格式化后的金额
   */
  const formatMoney = (amount) => {
    if (!amount) return '0'
    return parseInt(amount).toLocaleString()
  }

  /**
   * 生成预测号码（支持不同生成规则）
   * @param {String} rule - 生成规则：'random'、'probability' 或 'sequence'
   * @returns {Object} 预测结果
   */
  const generatePrediction = (rule = 'random', options = {}) => {
    if (!loaded.value || !collisionIndex.value) {
      throw new Error('历史开奖数据尚未加载完成，请稍后再生成')
    }
    const dataToUse = hasActiveFilter.value ? filteredData.value : data.value

    let redBalls = []
    let blueBall = 0
    let generationNotes = []

    if (rule === 'probability') {
      // 基于概率生成
      redBalls = generateProbabilityBasedRedBalls(dataToUse)
      blueBall = generateProbabilityBasedBlueBall(dataToUse)
    } else if (rule === 'sequence') {
      if (dataToUse.length === 0) {
        throw new Error('当前筛选范围没有可用于相邻推演的数据')
      }
      const model = buildTransitionModel(dataToUse, {
        mode: options.mode || 'classic',
        trainingWindow: options.trainingWindow ?? null
      })
      const startNumber = Number.isInteger(options.startNumber)
        ? options.startNumber
        : Math.floor(Math.random() * 33) + 1
      const sequenceResult = generateGreedyChain(model, startNumber, {
        mode: options.mode || 'classic'
      })
      redBalls = [...sequenceResult.sortedBalls]
      generationNotes = sequenceResult.steps.map((step, index) => {
        const probability = ((step.pathProbability ?? step.probability ?? 0) * 100).toFixed(2)
        return `第${index + 2}位：${String(step.number).padStart(2, '0')}（${step.model || step.source || '相邻概率'}，${probability}%）`
      })
      generationNotes.unshift(`第1位：${String(startNumber).padStart(2, '0')}（${Number.isInteger(options.startNumber) ? '用户选择' : '随机起点'}）`)
      blueBall = generateRandomBlueBall()
    } else {
      // 随机生成
      redBalls = generateRandomRedBalls()
      blueBall = generateRandomBlueBall()
    }

    const collision = checkHistoricalCollision(collisionIndex.value || data.value, {
      redBalls,
      blueBall
    })

    return {
      frontWinningNum: redBalls.map(n => n.toString().padStart(2, '0')).join(' '),
      backWinningNum: blueBall.toString().padStart(2, '0'),
      isHistorical: collision.fullCombinationCollision,
      collision,
      rule,
      generationNotes
    }
  }

  /**
   * 随机生成红球号码
   * @returns {Array} 红球号码数组
   */
  const generateRandomRedBalls = () => {
    const redBalls = []
    while (redBalls.length < 6) {
      const num = Math.floor(Math.random() * 33) + 1
      if (!redBalls.includes(num)) {
        redBalls.push(num)
      }
    }
    return redBalls.sort((a, b) => a - b)
  }

  /**
   * 随机生成蓝球号码
   * @returns {Number} 蓝球号码
   */
  const generateRandomBlueBall = () => {
    return Math.floor(Math.random() * 16) + 1
  }

  /**
   * 基于概率生成红球号码
   * @param {Array} dataToUse - 用于分析的数据
   * @returns {Array} 红球号码数组
   */
  const generateProbabilityBasedRedBalls = (dataToUse) => {
    const redBallStats = getRedBallStats(dataToUse)
    const sortedStats = redBallStats.sort((a, b) => b.count - a.count)
    
    // 取前15个最常出现的号码作为候选
    const candidates = sortedStats.slice(0, 15).map(item => item.number)
    
    const redBalls = []
    while (redBalls.length < 6) {
      // 根据概率权重选择号码
      const weights = candidates.map(num => {
        const stat = sortedStats.find(s => s.number === num)
        return stat ? stat.count : 1
      })
      
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
      let random = Math.random() * totalWeight
      
      for (let i = 0; i < candidates.length; i++) {
        random -= weights[i]
        if (random <= 0 && !redBalls.includes(candidates[i])) {
          redBalls.push(candidates[i])
          break
        }
      }
      
      // 如果权重选择失败，随机选择
      if (redBalls.length < 6) {
        const available = candidates.filter(num => !redBalls.includes(num))
        if (available.length > 0) {
          const randomIndex = Math.floor(Math.random() * available.length)
          redBalls.push(available[randomIndex])
        }
      }
    }
    
    return redBalls.sort((a, b) => a - b)
  }

  /**
   * 基于概率生成蓝球号码
   * @param {Array} dataToUse - 用于分析的数据
   * @returns {Number} 蓝球号码
   */
  const generateProbabilityBasedBlueBall = (dataToUse) => {
    const blueBallStats = getBlueBallStats(dataToUse)
    const sortedStats = blueBallStats.sort((a, b) => b.count - a.count)
    
    // 取前8个最常出现的蓝球作为候选
    const candidates = sortedStats.slice(0, 8).map(item => item.number)
    
    // 根据概率权重选择号码
    const weights = candidates.map(num => {
      const stat = sortedStats.find(s => s.number === num)
      return stat ? stat.count : 1
    })
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let random = Math.random() * totalWeight
    
    for (let i = 0; i < candidates.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return candidates[i]
      }
    }
    
    // 如果权重选择失败，返回第一个候选
    return candidates[0] || 1
  }

  /**
   * 根据期数区间获取训练数据
   * @param {String} startIssue - 开始期数
   * @param {String} endIssue - 结束期数
   * @returns {Array} 训练数据
   */
  const getTrainingData = (startIssue, endIssue) => {
    if (!startIssue && !endIssue) return data.value
    
    return data.value.filter(item => {
      const issue = parseInt(item.issue)
      const start = startIssue ? parseInt(startIssue) : 0
      const end = endIssue ? parseInt(endIssue) : Infinity
      return issue >= start && issue <= end
    })
  }

  /**
   * 根据期数获取测试数据
   * @param {String} startIssue - 开始期数
   * @param {Number} count - 数量
   * @returns {Array} 测试数据
   */
  const getTestData = (startIssue, count = 20) => {
    if (!startIssue) return []
    
    return data.value
      .filter(item => parseInt(item.issue) > parseInt(startIssue))
      .sort((a, b) => parseInt(a.issue) - parseInt(b.issue))
      .slice(0, count)
  }

  /**
   * 执行位置分析预测
   * @param {Object} params - 预测参数
   * @returns {Object} 预测分析结果
   */
  const performPositionAnalysis = (params = {}) => {
    if (!loaded.value || !collisionIndex.value) {
      throw new Error('历史开奖数据尚未加载完成，请稍后再分析')
    }
    const {
      trainingStartIssue = analysisParams.value.trainingStartIssue,
      trainingEndIssue = analysisParams.value.trainingEndIssue,
      predictionCount = analysisParams.value.predictionCount
    } = params

    if (!trainingStartIssue || !trainingEndIssue) {
      throw new Error('请设置训练数据区间')
    }

    // 获取训练数据
    const trainingData = getTrainingData(trainingStartIssue, trainingEndIssue)
    
    // 获取测试数据（从训练数据结束期的下一期开始）
    const testStartIssue = (parseInt(trainingEndIssue) + 1).toString()
    const testData = getTestData(testStartIssue, predictionCount)
    
    // 生成预测
    const predictions = []
    for (let i = 0; i < predictionCount; i++) {
      // 根据训练数据量调整随机因子
      const dynamicRandomFactor = trainingData.length < 10 ? 0.9 : 
                                  trainingData.length < 100 ? 0.5 : 0.1
      
      const prediction = generatePositionBasedPrediction(trainingData, {
        useTopN: 3,
        randomFactor: dynamicRandomFactor
      })
      const redBalls = prediction.frontWinningNum.split(' ').map(Number)
      const blueBall = Number(prediction.backWinningNum)
      predictions.push({
        ...prediction,
        collision: checkHistoricalCollision(collisionIndex.value || data.value, { redBalls, blueBall })
      })
    }

    // 验证预测准确性
    const validation = validatePredictions(predictions, testData)
    
    // 计算收益分析
    const roiAnalysis = calculateROI(predictions, testData)

    // 获取位置分析详情
    const positionAnalysis = analyzeRedBallPositions(trainingData)
    const blueAnalysis = analyzeBlueBallFrequency(trainingData)

    return {
      trainingDataSize: trainingData.length,
      testDataSize: testData.length,
      predictions,
      testData,
      validation,
      roiAnalysis,
      positionAnalysis,
      blueAnalysis,
      parameters: {
        trainingStartIssue,
        trainingEndIssue,
        testStartIssue,
        predictionCount
      }
    }
  }

  return {
    // 状态
    data,
    loading,
    loaded,
    filteredData,
    hasActiveFilter,
    searchParams,
    sortParams,
    pagination,
    analysisParams,
    
    // 计算属性
    paginatedData,
    statistics,
    transitionData: computed(() => hasActiveFilter.value ? filteredData.value : data.value),
    collisionIndex,
    
    // 方法
    loadData,
    filterData,
    handleSearch,
    handleReset,
    getRedBallStats,
    getBlueBallStats,
    getStatistics,
    getTrendData,
    formatMoney,
    generatePrediction,
    getTrainingData,
    getTestData,
    performPositionAnalysis,
    getIssueRange,
    setDefaultAnalysisParams,
    getIssueList,
    setDefaultSearchParams
  }
})
