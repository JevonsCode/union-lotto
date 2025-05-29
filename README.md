# 双色球数据分析系统

一个基于 Vue 3 + Pinia + Arco Design 的双色球数据分析和预测系统。

## 🌟 在线演示

🔗 **[访问在线演示](https://jevonscode.github.io/union-lotto/)**

## 🚀 功能特性

- ✅ **数据查询与筛选**：支持按期数、日期范围筛选开奖数据
- ✅ **统计分析**：展示总期数、奖池金额、销售额等统计信息
- ✅ **可视化图表**：红球/蓝球分布统计、奖池趋势图
- ✅ **智能预测**：
  - 随机预测：基于历史数据生成不重复的号码组合
  - 位置分析预测：基于位置统计的智能预测算法
- ✅ **预测验证**：支持预测准确性验证和ROI分析
- ✅ **响应式设计**：支持移动端和桌面端
- ✅ **现代化架构**：使用 Pinia 状态管理、Sass 样式

## 🛠️ 技术栈

- **前端框架**：Vue 3 (Composition API)
- **状态管理**：Pinia
- **UI 组件库**：Arco Design Vue
- **图表库**：ECharts + vue-echarts
- **样式预处理**：Sass/SCSS
- **构建工具**：Vite
- **包管理器**：pnpm

## 📁 项目结构

```
src/
├── components/          # 组件目录
│   ├── PredictionGenerator.vue  # 随机预测生成组件
│   └── PositionAnalysis.vue     # 位置分析预测组件
├── stores/             # Pinia 状态管理
│   ├── index.js        # Store 入口
│   └── lottoStore.js   # 双色球数据 Store
├── styles/             # 样式文件
│   └── app.scss        # 全局样式
├── utils/              # 工具函数
│   └── predictionUtils.js  # 预测算法工具
├── App.vue             # 主应用组件
└── main.js             # 应用入口
```

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/JevonsCode/union-lotto.git
cd union-lotto

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 构建部署

```bash
# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview
```

## 📊 数据来源

数据来源于国家体育总局体育彩票管理中心官方网站。

## 🎯 核心功能

### 1. 位置分析预测算法

- **训练数据配置**：可自定义训练数据区间
- **位置统计分析**：分析每个位置上号码的出现频率
- **预测算法**：基于位置频率的加权随机选择
- **验证与评估**：
  - 预测准确性验证
  - 投资回报率(ROI)计算
  - 中奖率分析

### 2. 数据可视化

- 红球号码分布图
- 蓝球号码分布图  
- 奖池金额趋势图
- 支持排序和交互

## 🚀 部署到 GitHub Pages

本项目已配置自动部署到 GitHub Pages：

1. Fork 本项目到你的 GitHub 账户
2. 修改 `package.json` 中的 `homepage` 和 `repository` 字段
3. 修改 `vite.config.js` 中的 `base` 路径
4. 在 GitHub 仓库设置中启用 Pages，源选择 "GitHub Actions"
5. 推送代码到 main 分支即可自动部署

## 📝 使用说明

1. **数据查询**：在查询框中输入期数进行筛选
2. **随机预测**：点击"生成预测"按钮获取不重复的号码组合
3. **位置分析预测**：
   - 设置训练数据区间
   - 设置预测期数（1-100期）
   - 点击"开始分析"执行预测分析
   - 查看预测准确性、收益分析等结果
4. **图表分析**：查看红球/蓝球分布统计，支持按号码或次数排序
5. **趋势分析**：观察奖池金额的历史变化趋势

## ⚠️ 免责声明

本系统仅供学习和研究使用，预测结果不构成任何投资建议。彩票具有随机性，请理性购彩。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

⭐ 如果这个项目对你有帮助，请给个 Star！
