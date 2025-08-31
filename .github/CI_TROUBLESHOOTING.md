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
