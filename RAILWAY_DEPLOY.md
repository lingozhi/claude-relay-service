# 🚂 Railway 部署指南

本指南将帮助你在 Railway 平台上快速部署 Claude Relay Service。

---

## 📋 部署前准备

1. **注册 Railway 账号**: https://railway.app/
2. **准备好 Claude 账号**（用于 OAuth 授权）
3. **GitHub 账号**（用于关联仓库）

---

## 🚀 部署步骤

### **第一步：Fork 项目（可选）**

如果你需要自定义代码，先 Fork 项目到自己的 GitHub：

```
https://github.com/Wei-Shaw/claude-relay-service
```

### **第二步：在 Railway 创建项目**

1. 登录 Railway: https://railway.app/
2. 点击 **New Project**
3. 选择 **Deploy from GitHub repo**
4. 授权 GitHub 并选择你的仓库
5. Railway 会自动识别 Dockerfile 并开始构建

### **第三步：添加 Redis 服务**

1. 在项目页面点击 **New**
2. 选择 **Database** → **Add Redis**
3. Railway 会自动创建 Redis 实例并注入环境变量：
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`

### **第四步：配置环境变量**

点击你的服务 → **Variables** → **RAW Editor**，粘贴以下配置：

```env
# 🔐 安全配置（必须修改！）
JWT_SECRET=CRS-Railway-2025-JWT-Random-Secret-Key-At-Least-32-Characters-Long
ENCRYPTION_KEY=Railway2025EncryptKey-32CharsEx

# 📊 Redis 配置（Railway 自动注入，无需修改）
# REDIS_HOST=${{Redis.REDIS_HOST}}
# REDIS_PORT=${{Redis.REDIS_PORT}}
# REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

# 🌐 服务配置
NODE_ENV=production
HOST=0.0.0.0

# 👤 管理员账号（可选，留空自动生成）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123

# 📝 日志配置
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=3

# 🌍 时区配置（中国时区 UTC+8）
TIMEZONE_OFFSET=8

# 🔗 会话配置
STICKY_SESSION_TTL_HOURS=1
STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES=15

# 🎯 Claude API 配置
CLAUDE_API_URL=https://api.anthropic.com/v1/messages
CLAUDE_API_VERSION=2023-06-01
CLAUDE_BETA_HEADER=claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14

# 🌐 代理配置
DEFAULT_PROXY_TIMEOUT=600000
MAX_PROXY_RETRIES=3
PROXY_USE_IPV4=true
REQUEST_TIMEOUT=600000

# 📈 使用限制
DEFAULT_TOKEN_LIMIT=1000000

# 🔧 系统配置
CLEANUP_INTERVAL=3600000
TOKEN_USAGE_RETENTION=2592000000
HEALTH_CHECK_INTERVAL=60000
METRICS_WINDOW=5

# 🎨 Web 界面配置
WEB_TITLE=Claude Relay Service
WEB_DESCRIPTION=Multi-account Claude API relay service
WEB_LOGO_URL=/assets/logo.png

# 🛠️ 开发配置
DEBUG=false
ENABLE_CORS=true
TRUST_PROXY=true

# 👥 用户管理配置
USER_MANAGEMENT_ENABLED=false
DEFAULT_USER_ROLE=user
USER_SESSION_TIMEOUT=86400000
MAX_API_KEYS_PER_USER=1
ALLOW_USER_DELETE_API_KEYS=false
```

**重要提醒：**
- 务必修改 `JWT_SECRET` 和 `ENCRYPTION_KEY` 为随机值
- `JWT_SECRET` 至少 32 个字符
- `ENCRYPTION_KEY` 必须是 32 个字符
- 如果设置了 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，使用这些凭据登录
- 如果留空，系统会自动生成（查看日志获取）

### **第五步：部署并查看日志**

1. Railway 会自动开始部署
2. 点击 **Deployments** 查看构建进度
3. 部署成功后，点击 **View Logs** 查看日志
4. 查找包含 `Admin credentials` 的日志行，获取管理员账号

示例日志：
```
✅ 系统初始化完成
📋 管理员凭据:
   用户名: admin
   密码: YourSecurePassword123
```

### **第六步：配置域名**

1. 在服务页面点击 **Settings** → **Networking**
2. Railway 会自动分配一个域名：`your-project.up.railway.app`
3. 或者点击 **Custom Domain** 添加自定义域名

### **第七步：访问服务**

```
Web 管理界面: https://your-project.up.railway.app/web
健康检查: https://your-project.up.railway.app/health
API 端点: https://your-project.up.railway.app/api/
```

---

## 🔧 配置 Redis 变量引用

Railway 提供了两种方式引用 Redis 环境变量：

### **方式 1：自动注入（推荐）**

Railway 会自动将 Redis 插件的环境变量注入到你的服务中：
- `REDIS_HOST` → Redis 插件的 `REDIS_HOST`
- `REDIS_PORT` → Redis 插件的 `REDIS_PORT`
- `REDIS_PASSWORD` → Redis 插件的 `REDIS_PASSWORD`

无需手动配置，系统会自动识别。

### **方式 2：显式引用**

如果自动注入不生效，可以在 Variables 中手动设置：

```env
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
```

**注意：** `${{Redis.XXX}}` 中的 `Redis` 是你 Redis 服务的名称，如果你重命名了 Redis 服务，需要相应修改。

---

## 📊 持久化存储

Railway 默认提供 **临时磁盘存储**，容器重启后数据会丢失。

### **解决方案 1：使用 Railway Volumes（推荐）**

1. 在服务页面点击 **Settings** → **Volumes**
2. 点击 **Add Volume**
3. 挂载路径：
   - `/app/data` → 管理员账号数据
   - `/app/logs` → 日志文件

### **解决方案 2：使用外部存储**

- **管理员账号**: 通过环境变量 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 固定
- **日志**: 使用 Railway 的日志查看功能
- **统计数据**: 都存储在 Redis 中，已持久化

---

## 🎮 配置客户端

部署成功后，配置 Claude Code 使用你的服务：

```bash
# Claude Code CLI
export ANTHROPIC_BASE_URL="https://your-project.up.railway.app/api/"
export ANTHROPIC_AUTH_TOKEN="cr_你的API密钥"

# 测试
claude
```

---

## 🐛 常见问题

### **问题 1：构建失败 - Dockerfile not found**

**解决方法：**
- 确保仓库根目录有 `Dockerfile`
- 检查 `railway.json` 中的 `dockerfilePath` 配置

### **问题 2：Redis 连接失败**

**检查步骤：**
1. 确认已添加 Redis 服务
2. 查看 Variables 中是否有 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`
3. 查看服务日志，确认 Redis 连接信息

**手动配置：**
```env
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}
```

### **问题 3：JWT_SECRET or ENCRYPTION_KEY 未设置**

**错误信息：**
```
❌ 错误: JWT_SECRET 环境变量未设置
```

**解决方法：**
- 在 Railway Variables 中添加这两个必填变量
- 确保 `JWT_SECRET` 至少 32 字符
- 确保 `ENCRYPTION_KEY` 恰好 32 字符

### **问题 4：找不到管理员账号**

**方式 1：查看部署日志**
```
Deployments → Latest Deploy → View Logs
搜索 "Admin credentials" 或 "管理员凭据"
```

**方式 2：使用环境变量预设**
在 Variables 中设置：
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourPassword123
```

### **问题 5：无法访问管理界面（404）**

**检查：**
- 确认前端已正确构建（查看 Dockerfile 的构建阶段）
- 访问 `https://your-domain/web` 而不是 `https://your-domain/`
- 检查健康检查：`https://your-domain/health`

---

## 💡 优化建议

### **1. 启用自定义域名**

Railway 免费提供 SSL 证书：
1. Settings → Networking → Custom Domain
2. 添加你的域名
3. 配置 DNS CNAME 记录指向 Railway 提供的地址

### **2. 配置环境分离**

创建多个环境：
- `production` - 生产环境
- `staging` - 测试环境

在 Railway 中创建多个项目或使用不同的分支部署。

### **3. 监控和告警**

Railway 提供：
- **实时日志**: Deployments → View Logs
- **指标监控**: Settings → Metrics（CPU、内存、网络）
- **健康检查**: 自动监控 `/health` 端点

### **4. 数据备份**

**定期备份 Redis 数据：**
```bash
# 在 Railway Shell 中执行
redis-cli --rdb /tmp/dump.rdb
```

**备份管理员账号：**
- 确保 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 保存在安全的地方
- 或者定期导出 `/app/data/init.json`

---

## 📈 费用说明

Railway 提供免费额度：
- **每月 $5 免费额度**（约 500 小时运行时间）
- **超出按量计费**：
  - 服务运行：~$0.01/小时
  - Redis 实例：~$0.01/小时

**估算：**
- 单服务 + Redis 24x7 运行：约 $15/月
- 使用免费额度：可运行 250 小时/月（约 10 天）

---

## 🎯 快速部署检查清单

- [ ] 创建 Railway 项目
- [ ] 添加 Redis 数据库
- [ ] 配置所有环境变量（特别是 JWT_SECRET 和 ENCRYPTION_KEY）
- [ ] 等待部署完成（约 3-5 分钟）
- [ ] 查看日志获取管理员账号
- [ ] 访问 Web 界面登录
- [ ] 添加 Claude 账户
- [ ] 创建 API Key
- [ ] 配置客户端测试

---

## 📞 获取帮助

- **Railway 文档**: https://docs.railway.app/
- **项目 GitHub**: https://github.com/Wei-Shaw/claude-relay-service
- **项目 Issues**: https://github.com/Wei-Shaw/claude-relay-service/issues

---

**部署完成后，记得给项目点个 Star ⭐！**
