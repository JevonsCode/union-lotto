/**
 * 双色球预测算法工具类
 * 基于历史数据的位置分析进行预测
 */

/**
 * 分析红球各位置的号码出现频率
 * @param {Array} data - 历史开奖数据
 * @returns {Array} 六个位置的号码频率统计
 */
export function analyzeRedBallPositions(data) {
  // 初始化6个位置的统计对象
  const positions = Array.from({ length: 6 }, () => ({}))
  
  data.forEach(item => {
    const redBalls = item.frontWinningNum.split(' ').map(n => parseInt(n))
    redBalls.sort((a, b) => a - b) // 按大小排序
    
    redBalls.forEach((num, index) => {
      if (index < 6) {
        positions[index][num] = (positions[index][num] || 0) + 1
      }
    })
  })
  
  // 转换为数组并排序
  return positions.map(positionStats => 
    Object.entries(positionStats)
      .map(([num, count]) => ({
        number: parseInt(num),
        count,
        probability: (count / data.length * 100).toFixed(2)
      }))
      .sort((a, b) => b.count - a.count)
  )
}

/**
 * 分析蓝球出现频率
 * @param {Array} data - 历史开奖数据
 * @returns {Array} 蓝球频率统计
 */
export function analyzeBlueBallFrequency(data) {
  const blueStats = {}
  
  data.forEach(item => {
    const blueNum = parseInt(item.backWinningNum)
    blueStats[blueNum] = (blueStats[blueNum] || 0) + 1
  })
  
  return Object.entries(blueStats)
    .map(([num, count]) => ({
      number: parseInt(num),
      count,
      probability: (count / data.length * 100).toFixed(2)
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 基于位置分析生成预测号码
 * @param {Array} trainingData - 训练数据
 * @param {Object} options - 预测选项
 * @returns {Object} 预测结果
 */
export function generatePositionBasedPrediction(trainingData, options = {}) {
  const { 
    useTopN = 3, // 每个位置取前N个高频号码
    randomFactor = 0.2 // 随机因子，0为完全按频率，1为完全随机
  } = options
  
  const positionAnalysis = analyzeRedBallPositions(trainingData)
  const blueAnalysis = analyzeBlueBallFrequency(trainingData)
  
  // 当训练数据不足时，增加随机因子
  const adjustedRandomFactor = trainingData.length < 10 ? 0.8 : randomFactor
  
  const redBalls = []
  const usedNumbers = new Set()
  
  // 为每个位置选择号码
  for (let position = 0; position < 6; position++) {
    let selectedNumber
    
    // 当数据不足时，采用更多随机策略
    if (trainingData.length < 5 || positionAnalysis[position].length === 0) {
      // 完全随机选择未使用的号码
      const availableNumbers = []
      for (let i = 1; i <= 33; i++) {
        if (!usedNumbers.has(i)) {
          availableNumbers.push(i)
        }
      }
      selectedNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
    } else {
      const candidates = positionAnalysis[position]
        .filter(item => !usedNumbers.has(item.number))
        .slice(0, Math.max(useTopN, 5)) // 至少保留5个候选
      
      if (Math.random() < adjustedRandomFactor) {
        // 随机选择
        selectedNumber = candidates[Math.floor(Math.random() * candidates.length)].number
      } else {
        // 按概率权重选择，但加入一些随机扰动
        const weights = candidates.map((item, index) => {
          // 添加随机扰动，避免完全相同的权重分布
          const randomNoise = 0.1 + Math.random() * 0.2
          return (item.count + randomNoise)
        })
        selectedNumber = weightedRandomSelect(candidates, weights).number
      }
    }
    
    redBalls.push(selectedNumber)
    usedNumbers.add(selectedNumber)
  }
  
  // 选择蓝球 - 也增加随机性
  let selectedBlue
  if (trainingData.length < 5 || blueAnalysis.length === 0) {
    // 完全随机选择蓝球
    selectedBlue = { number: Math.floor(Math.random() * 16) + 1 }
  } else {
    const blueTopCandidates = blueAnalysis.slice(0, 8)
    if (Math.random() < adjustedRandomFactor) {
      // 随机选择
      selectedBlue = blueTopCandidates[Math.floor(Math.random() * blueTopCandidates.length)]
    } else {
      // 按权重选择，加入随机扰动
      const blueWeights = blueTopCandidates.map((item, index) => {
        const randomNoise = 0.1 + Math.random() * 0.2
        return (item.count + randomNoise)
      })
      selectedBlue = weightedRandomSelect(blueTopCandidates, blueWeights)
    }
  }
  
  return {
    frontWinningNum: redBalls.sort((a, b) => a - b).map(n => n.toString().padStart(2, '0')).join(' '),
    backWinningNum: selectedBlue.number.toString().padStart(2, '0'),
    algorithm: 'position-based',
    confidence: calculateConfidence(positionAnalysis, blueAnalysis),
    details: {
      positionAnalysis,
      blueAnalysis,
      selectedNumbers: {
        red: redBalls,
        blue: selectedBlue.number
      },
      trainingDataSize: trainingData.length,
      adjustedRandomFactor
    }
  }
}

/**
 * 加权随机选择
 * @param {Array} items - 候选项
 * @param {Array} weights - 权重数组
 * @returns {Object} 选中的项
 */
function weightedRandomSelect(items, weights) {
  if (!items || items.length === 0) {
    return null
  }
  
  // 如果只有一个选项，直接返回
  if (items.length === 1) {
    return items[0]
  }
  
  const totalWeight = weights.reduce((sum, weight) => sum + (weight || 0), 0)
  
  // 如果总权重为0或很小，采用等权重随机选择
  if (totalWeight <= 0.001) {
    return items[Math.floor(Math.random() * items.length)]
  }
  
  let random = Math.random() * totalWeight
  
  for (let i = 0; i < items.length; i++) {
    random -= (weights[i] || 0)
    if (random <= 0) {
      return items[i]
    }
  }
  
  // 兜底：随机返回一个
  return items[Math.floor(Math.random() * items.length)]
}

/**
 * 计算预测置信度
 * @param {Array} positionAnalysis - 位置分析结果
 * @param {Array} blueAnalysis - 蓝球分析结果
 * @returns {Number} 置信度分数 (0-100)
 */
function calculateConfidence(positionAnalysis, blueAnalysis) {
  // 基于数据分布的一致性计算置信度
  const redConsistency = positionAnalysis.map(position => {
    if (position.length === 0) return 0
    const topProb = parseFloat(position[0].probability)
    const avgProb = position.slice(0, 5).reduce((sum, item) => sum + parseFloat(item.probability), 0) / 5
    return topProb / avgProb
  }).reduce((sum, val) => sum + val, 0) / 6
  
  const blueTopProb = blueAnalysis.length > 0 ? parseFloat(blueAnalysis[0].probability) : 0
  const blueAvgProb = blueAnalysis.slice(0, 5).reduce((sum, item) => sum + parseFloat(item.probability), 0) / 5
  const blueConsistency = blueTopProb / blueAvgProb
  
  const confidence = Math.min(100, (redConsistency + blueConsistency) * 25)
  return Math.round(confidence)
}

/**
 * 验证预测准确性
 * @param {Array} predictions - 预测结果数组
 * @param {Array} actualResults - 实际开奖结果
 * @returns {Object} 验证统计
 */
export function validatePredictions(predictions, actualResults) {
  const stats = {
    totalPredictions: predictions.length,
    redBallMatches: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    blueBallMatches: 0,
    fullMatches: 0,
    avgRedMatches: 0,
    accuracy: {
      red: 0,
      blue: 0,
      overall: 0
    }
  }
  
  if (predictions.length === 0 || actualResults.length === 0) {
    return stats
  }
  
  let totalRedMatches = 0
  
  predictions.forEach((prediction, index) => {
    if (index >= actualResults.length) return
    
    const actual = actualResults[index]
    const predRedBalls = prediction.frontWinningNum.split(' ').map(n => parseInt(n))
    const actualRedBalls = actual.frontWinningNum.split(' ').map(n => parseInt(n))
    const predBlue = parseInt(prediction.backWinningNum)
    const actualBlue = parseInt(actual.backWinningNum)
    
    // 计算红球匹配数
    const redMatches = predRedBalls.filter(num => actualRedBalls.includes(num)).length
    stats.redBallMatches[redMatches]++
    totalRedMatches += redMatches
    
    // 计算蓝球匹配
    if (predBlue === actualBlue) {
      stats.blueBallMatches++
    }
    
    // 全中检查
    if (redMatches === 6 && predBlue === actualBlue) {
      stats.fullMatches++
    }
  })
  
  stats.avgRedMatches = (totalRedMatches / predictions.length).toFixed(2)
  stats.accuracy.red = ((totalRedMatches / (predictions.length * 6)) * 100).toFixed(2)
  stats.accuracy.blue = ((stats.blueBallMatches / predictions.length) * 100).toFixed(2)
  stats.accuracy.overall = (((totalRedMatches + stats.blueBallMatches) / (predictions.length * 7)) * 100).toFixed(2)
  
  return stats
}

/**
 * 计算投注收益分析
 * @param {Array} predictions - 预测结果
 * @param {Array} actualResults - 实际开奖结果  
 * @param {Object} prizeTable - 奖级表
 * @returns {Object} 收益分析
 */
export function calculateROI(predictions, actualResults, prizeTable = {}) {
  const defaultPrizeTable = {
    '6+1': 5000000,    // 一等奖
    '6+0': 200000,     // 二等奖
    '5+1': 3000,       // 三等奖
    '5+0': 200,        // 四等奖
    '4+1': 200,        // 四等奖
    '4+0': 10,         // 五等奖
    '3+1': 10,         // 五等奖
    '2+1': 5,          // 六等奖
    '1+1': 5,          // 六等奖
    '0+1': 5           // 六等奖
  }
  
  const prizes = { ...defaultPrizeTable, ...prizeTable }
  const betCost = 2 // 每注2元
  
  let totalCost = predictions.length * betCost
  let totalWinnings = 0
  const winBreakdown = {}
  
  predictions.forEach((prediction, index) => {
    if (index >= actualResults.length) return
    
    const actual = actualResults[index]
    const predRedBalls = prediction.frontWinningNum.split(' ').map(n => parseInt(n))
    const actualRedBalls = actual.frontWinningNum.split(' ').map(n => parseInt(n))
    const predBlue = parseInt(prediction.backWinningNum)
    const actualBlue = parseInt(actual.backWinningNum)
    
    const redMatches = predRedBalls.filter(num => actualRedBalls.includes(num)).length
    const blueMatch = predBlue === actualBlue ? 1 : 0
    
    const key = `${redMatches}+${blueMatch}`
    if (prizes[key]) {
      totalWinnings += prizes[key]
      winBreakdown[key] = (winBreakdown[key] || 0) + 1
    }
  })
  
  const roi = ((totalWinnings - totalCost) / totalCost * 100).toFixed(2)
  
  return {
    totalCost,
    totalWinnings,
    netProfit: totalWinnings - totalCost,
    roi: parseFloat(roi),
    winBreakdown,
    averageWinning: (totalWinnings / predictions.length).toFixed(2),
    breakEvenRate: ((totalCost / totalWinnings) * 100).toFixed(2)
  }
} 