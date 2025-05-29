# 🚀 CI/CD 配置说明

本项目使用 GitHub Actions 实现自动化的持续集成和持续部署。

## 📋 工作流说明

### 1. 部署工作流 (`deploy.yml`)

**触发条件：**
- 推送到 `master` 或 `main` 分支
- 创建针对 `master` 或 `main` 分支的 Pull Request
- 手动触发 (`workflow_dispatch`)

**功能：**
- 🏗️ **构建项目**：使用 pnpm 安装依赖并构建生产版本
- 🚀 **自动部署**：将构建结果部署到 GitHub Pages
- 💬 **PR预览**：为 Pull Request 提供构建状态反馈
- 🗂️ **缓存优化**：缓存 pnpm store 以加速构建

**部署地址：**
- GitHub Pages: `https://jevonscode.github.io/union-lotto/`
- 自定义域名: `https://xn--8ovp9s.xn--m8txu.com/`

### 2. 持续集成工作流 (`ci.yml`)

**触发条件：**
- 推送到任何分支
- 创建 Pull Request
- 每周一早上8点定时检查

**功能：**
- 🔍 **代码检查**：运行 ESLint 等代码质量检查
- 🧪 **自动测试**：执行项目测试套件
- 🔒 **安全审计**：检查依赖项安全漏洞
- 🔄 **依赖项检查**：定期检查过时的依赖项

## 🔧 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm run build:prod

# 部署到 GitHub Pages
pnpm run deploy
```

## 📦 环境要求

- Node.js 18+
- pnpm 8+
- Git

## 🎯 自动化特性

### ✅ 已配置
- [x] 自动构建和部署
- [x] 依赖项缓存
- [x] 安全审计
- [x] PR 状态检查
- [x] 手动触发部署

### 🔮 未来增强
- [ ] 单元测试覆盖率报告
- [ ] 性能监控
- [ ] 自动依赖项更新
- [ ] 多环境部署

## 🐛 故障排除

### 部署失败
1. 检查 GitHub Pages 设置是否正确
2. 确认分支名称匹配工作流配置
3. 查看 Actions 日志获取详细错误信息

### 构建失败
1. 本地测试构建命令：`pnpm run build:prod`
2. 检查依赖项是否正确安装
3. 确认所有必需的环境变量已设置

### 权限问题
1. 确认仓库设置中的 Pages 权限
2. 检查 Actions 权限设置
3. 验证 GITHUB_TOKEN 权限

## 📞 联系方式

如有问题，请提交 Issue 或联系项目维护者。 