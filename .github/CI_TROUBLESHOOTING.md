# GitHub Actions CI/CD 故障排除指南

## 常见问题

### 1. pnpm-lock.yaml 兼容性问题

**错误信息：**
```
WARN  Ignoring not compatible lockfile at /home/runner/work/union-lotto/union-lotto/pnpm-lock.yaml
ERR_PNPM_NO_LOCKFILE  Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent
```

**解决方案：**

#### 方案 A：更新 pnpm 版本（推荐）
- 确保 GitHub Actions 中使用与本地相同的 pnpm 版本
- 当前项目使用 pnpm 10.x，lockfile 版本为 9.0

#### 方案 B：使用兼容的安装命令
```yaml
- name: 🔧 Install dependencies
  run: |
    pnpm install --frozen-lockfile || pnpm install --no-frozen-lockfile
```

#### 方案 C：重新生成 lockfile
```bash
# 删除旧的 lockfile
rm pnpm-lock.yaml

# 重新安装依赖
pnpm install

# 提交新的 lockfile
git add pnpm-lock.yaml
git commit -m "chore: regenerate pnpm-lock.yaml"
```

### 2. Node.js 版本兼容性

**推荐配置：**
- Node.js: 20.x (LTS)
- pnpm: 10.x
- 确保与本地开发环境版本一致

### 3. 缓存问题

如果遇到缓存相关的问题，可以：
1. 清除 GitHub Actions 缓存
2. 在 workflow 中添加缓存清理步骤
3. 使用不同的缓存键

## 当前配置

### 主要 CI 配置
- 文件：`.github/workflows/ci.yml`
- 功能：完整的 CI 流程，包括测试、安全检查等

### 简化 CI 配置
- 文件：`.github/workflows/ci-simple.yml`
- 功能：基本的构建和测试

### 部署配置
- 文件：`.github/workflows/deploy.yml`
- 功能：自动部署到 GitHub Pages

### 数据更新配置
- 文件：`.github/workflows/update-data.yml`
- 功能：自动更新爬虫数据
- 触发条件：
  - 每天凌晨2点自动运行
  - 手动触发
  - 爬虫脚本更新时触发

## 数据更新功能

### 自动更新机制
- **定时更新**：每天凌晨2点自动运行爬虫更新数据
- **手动触发**：可在 GitHub Actions 页面手动触发数据更新
- **代码触发**：当爬虫脚本或 package.json 更新时自动触发

### 更新流程
1. 运行爬虫脚本获取最新数据
2. 检查数据文件是否有变化
3. 如果有新数据，自动提交到仓库
4. 生成更新摘要报告

### 数据文件
- **源文件**：`data/get-numbers.js` - 爬虫脚本
- **数据文件**：`data/lotto-data.json` - 爬取的历史数据
- **公共文件**：`public/data/lotto-data.json` - 前端访问的数据文件

## 故障排除步骤

1. **检查版本兼容性**
   ```bash
   node --version
   pnpm --version
   ```

2. **验证本地构建**
   ```bash
   pnpm install
   pnpm build
   ```

3. **检查 lockfile**
   ```bash
   # 查看 lockfile 版本
   head -5 pnpm-lock.yaml
   ```

4. **重新生成依赖**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

## 联系支持

如果问题仍然存在，请：
1. 检查 GitHub Actions 日志
2. 确认本地环境配置
3. 更新到最新的稳定版本
