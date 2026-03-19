# Phase 4 任务分解 — 企业加固与生产就绪

## 总览

Phase 4 将 Skillhub 从"可用"提升为"企业生产级"：完整 RBAC、审计追踪、遥测分析、CI/CD、安全加固、生产部署。

**前置条件：** Phase 3 全部完成（Web UI + MCP 可用）

---

## P4-1: 完整 RBAC 系统

**复杂度：** 高

**权限矩阵：**

| 操作 | Global Admin | NS Maintainer | Viewer |
|------|:-----------:|:-------------:|:------:|
| 创建命名空间 | ✅ | ✅ | ❌ |
| 删除命名空间 | ✅ | ❌ (自己的也不行) | ❌ |
| Push 技能 | ✅ (全局) | ✅ (自己的 NS) | ❌ |
| 删除技能 | ✅ (全局) | ✅ (自己的 NS) | ❌ |
| Pull/Install 技能 | ✅ | ✅ | ✅ (public/internal) |
| 搜索技能 | ✅ | ✅ | ✅ (public/internal) |
| 查看 private NS | ✅ | ✅ (成员) | ❌ |
| 管理 NS 成员 | ✅ | ✅ (自己的 NS) | ❌ |
| 提升用户角色 | ✅ | ❌ | ❌ |
| 查看审计日志 | ✅ | ❌ | ❌ |
| 管理 Machine Token | ✅ | ✅ (自己的) | ✅ (自己的) |

**子任务：**
- [P4-1.1] 实现 `middleware/rbac.ts`:
  - `requireAuth()` — 必须已认证
  - `requireRole(role)` — 必须是指定全局角色
  - `requireNsRole(nsParam, role)` — 必须是指定命名空间的指定角色
  - `requireNsMemberOrPublic(nsParam)` — 必须是成员或命名空间为 public/internal
- [P4-1.2] 为所有现有路由添加 RBAC 中间件
- [P4-1.3] 实现 private 命名空间过滤：搜索/列表 API 自动排除用户无权访问的 private NS
- [P4-1.4] Admin API:
  - `PUT /api/admin/users/:id/role` — 修改用户全局角色
  - `GET /api/admin/users` — 用户列表 (admin only)
  - `DELETE /api/admin/users/:id` — 禁用用户
- [P4-1.5] 前端权限 UI:
  - 根据角色隐藏/禁用按钮 (Push、Delete、Settings)
  - Admin 菜单仅 admin 可见
  - 403 错误页面

**验收标准：**
- Viewer 无法 push，返回 403
- Maintainer 只能操作自己的命名空间
- Private NS 对非成员完全不可见
- Admin 可以操作一切

**单元测试 (10)：**
- Viewer 不能 push / Maintainer 可以 push 到自己的 NS
- Maintainer 不能 push 到其他 NS / Admin 可以 push 到任何 NS
- Private NS 对非成员不可见 / Public NS 对所有人可见
- Admin 可以提升角色 / 非 Admin 不能提升角色
- 403 错误格式正确 / 未认证返回 401

---

## P4-2: 安全加固

**复杂度：** 高

**子任务：**
- [P4-2.1] Rate Limiting:
  - 安装 `hono-rate-limiter`
  - 全局: 100 req/min/IP
  - 登录: 10 req/min/IP
  - Push: 30 req/min/user
  - Device Code: 5 req/min/IP
- [P4-2.2] CORS 配置:
  - 开发: 允许 localhost:3000
  - 生产: 只允许前端域名
- [P4-2.3] 输入校验加固:
  - 所有 API 参数严格 zod schema
  - Namespace 名称: `/^@[a-z0-9]([a-z0-9-]*[a-z0-9])?$/`
  - Skill 名称: `/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/`
  - Tag: `/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/`
  - URL: `z.string().url()`
- [P4-2.4] Tarball 安全:
  - 文件大小限制 (默认 50MB)
  - 解压后文件数限制 (默认 1000)
  - 禁止符号链接 (Zip Slip 防护)
  - 禁止 `..` 路径穿越
  - 禁止绝对路径
- [P4-2.5] Markdown XSS 防护:
  - 使用 `rehype-sanitize` 清洗 SKILL.md 渲染输出
  - 禁止 `<script>`, `<iframe>`, `on*` 事件
- [P4-2.6] Token 吊销:
  ```sql
  CREATE TABLE revoked_tokens (
    jti        VARCHAR(128) PRIMARY KEY,
    revoked_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL  -- 过期后自动清理
  );
  ```
  - JWT 中添加 `jti` (JWT ID)
  - 中间件检查 revoked_tokens 表
  - Logout 时吊销当前 token
- [P4-2.7] 安全头:
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`

**验收标准：**
- 超过限流阈值返回 429
- 恶意 tarball 被拒绝
- Markdown XSS payload 被过滤
- 已吊销 token 返回 401

**单元测试 (12)：**
- Rate limit 触发 / CORS 阻止跨域 / Namespace 名称校验 / Skill 名称校验
- Tarball 大小超限 / Tarball 含符号链接 / Tarball 含路径穿越
- Markdown XSS 过滤 / Token 吊销生效 / 安全头存在
- SQL 注入尝试被阻止 / 输入边界值测试

---

## P4-3: 审计日志

**复杂度：** 中

**新增表：** `audit_logs` (详见 ROADMAP.md)

**记录的操作：**
| Action | 触发时机 |
|--------|----------|
| `user.register` | 用户注册 |
| `user.login` | Device Code 认证完成 |
| `user.role_change` | 角色变更 |
| `namespace.create` | 创建命名空间 |
| `namespace.delete` | 删除命名空间 |
| `namespace.member_add` | 添加成员 |
| `namespace.member_remove` | 移除成员 |
| `skill.push` | 发布技能 |
| `skill.delete` | 删除技能 |
| `token.create` | 创建 Machine Token |
| `token.revoke` | 吊销 Token |

**子任务：**
- [P4-3.1] 创建 audit_logs 表迁移
- [P4-3.2] 实现审计日志服务 (`audit.service.ts`)
- [P4-3.3] 实现审计中间件：自动记录 mutation 操作 (POST/PUT/DELETE)
- [P4-3.4] Admin API: `GET /api/admin/audit?action=xxx&user=xxx&from=xxx&to=xxx`
- [P4-3.5] 前端审计日志页面 (`/admin/audit`)
- [P4-3.6] 审计日志自动清理 (保留 90 天, 可配置)

**验收标准：**
- 每个 mutation 操作自动记录
- Admin 可按条件查询审计日志
- 清理任务正确删除过期记录

**单元测试 (5)：**
- Push 操作被记录 / 查询按 action 过滤 / 查询按时间范围过滤 / 非 admin 无法查看 / 清理过期记录

---

## P4-4: 遥测系统

**复杂度：** 中

**子任务：**
- [P4-4.1] CLI 遥测:
  - 在 CLI 命令执行完毕后，异步上报事件 (不阻塞主流程)
  - 事件: `{event: "cli.install", skill: "@ns/name", cli_version: "0.1.0", os: "darwin"}`
  - 首次运行时提示用户遥测策略，可通过 `skillhub config telemetry false` 关闭
- [P4-4.2] Backend 遥测端点:
  - `POST /api/telemetry/events` (无需认证，但有 rate limit)
  - 批量接收事件，存入数据库或时序存储
- [P4-4.3] 下载计数:
  - `GET /api/skills/@ns/name/tags/:tag` 被调用时 `downloads += 1`
  - 使用 Redis 或内存缓冲批量更新 (避免每次 install 都写 DB)
- [P4-4.4] Web UI 统计面板:
  - 首页: "企业内最受欢迎的 10 大 AI 技能" 排行榜
  - 命名空间页: 技能数、总下载量
  - 技能详情页: 下载趋势图 (最近 30 天)
- [P4-4.5] 遥测数据表:
  ```sql
  CREATE TABLE telemetry_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event      VARCHAR(64) NOT NULL,
    skill      VARCHAR(255),
    cli_version VARCHAR(32),
    os         VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_telemetry_event ON telemetry_events(event);
  CREATE INDEX idx_telemetry_time ON telemetry_events(created_at);
  ```

---

## P4-5: 可观测性

**复杂度：** 中

**子任务：**
- [P4-5.1] 结构化日志:
  - 安装 `pino` + `pino-http`
  - 替换所有 `console.log` 为 pino logger
  - JSON 格式输出 (便于 ELK/Datadog 采集)
  - 请求 ID 追踪 (`X-Request-Id` header)
- [P4-5.2] Prometheus 指标:
  - 安装 `prom-client`
  - 暴露 `GET /metrics`
  - 指标:
    - `http_requests_total{method,path,status}` (counter)
    - `http_request_duration_seconds{method,path}` (histogram)
    - `db_pool_active_connections` (gauge)
    - `s3_operation_duration_seconds{operation}` (histogram)
    - `skill_downloads_total{namespace,name}` (counter)
- [P4-5.3] Docker Compose 可选 Prometheus + Grafana:
  - `docker/docker-compose.monitoring.yml` (可选叠加)
  - 预配置 Grafana dashboard
- [P4-5.4] 健康检查增强 (`GET /health`):
  ```json
  {
    "status": "ok",
    "version": "0.2.0",
    "uptime": 3600,
    "db": { "status": "connected", "pool": { "active": 2, "idle": 8, "total": 10 } },
    "s3": { "status": "connected", "bucket": "skillhub-artifacts" },
    "memory": { "rss": "128MB", "heapUsed": "64MB" }
  }
  ```

---

## P4-6: Docker 生产化

**复杂度：** 中

**子任务：**
- [P4-6.1] `docker/Dockerfile.backend` (优化):
  ```dockerfile
  # builder
  FROM node:22-alpine AS builder
  # ... pnpm install + build

  # runner
  FROM node:22-alpine AS runner
  RUN addgroup -S app && adduser -S app -G app
  USER app
  COPY --from=builder /app/dist ./dist
  CMD ["node", "dist/index.js"]
  ```
- [P4-6.2] `docker/Dockerfile.frontend` (standalone):
  ```dockerfile
  FROM node:22-alpine AS builder
  # ... next build (standalone)

  FROM node:22-alpine AS runner
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/.next/static ./.next/static
  COPY --from=builder /app/public ./public
  CMD ["node", "server.js"]
  ```
- [P4-6.3] `docker/docker-compose.prod.yml`:
  ```yaml
  services:
    nginx:
      image: nginx:alpine
      ports: ["80:80", "443:443"]
      volumes: [./nginx.conf:/etc/nginx/nginx.conf]
    backend:
      build: { dockerfile: docker/Dockerfile.backend }
      deploy: { replicas: 2 }
      environment: [DATABASE_URL, S3_*, JWT_SECRET]
    frontend:
      build: { dockerfile: docker/Dockerfile.frontend }
    postgres:
      image: postgres:16-alpine
      volumes: [pgdata:/var/lib/postgresql/data]
    minio:
      image: minio/minio
      volumes: [miniodata:/data]
  ```
- [P4-6.4] `docker/nginx.conf`:
  - `/api/*` → backend:3001
  - `/*` → frontend:3000
  - SSL 终结 (可选 Let's Encrypt)
  - gzip 压缩
- [P4-6.5] 自动迁移: backend 容器启动时先执行 `drizzle-kit migrate`
- [P4-6.6] 环境变量文档: 所有可配置项列表 + 说明 + 默认值

---

## P4-7: CI/CD Pipeline

**复杂度：** 中

**子任务：**
- [P4-7.1] `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    lint-and-typecheck:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: pnpm/action-setup@v4
        - run: pnpm install --frozen-lockfile
        - run: pnpm lint
        - run: pnpm typecheck

    unit-test:
      runs-on: ubuntu-latest
      steps:
        - run: pnpm test -- --coverage
        - uses: codecov/codecov-action@v4  # 覆盖率上报

    integration-test:
      runs-on: ubuntu-latest
      services:
        postgres: { image: postgres:16-alpine, env: ... }
        minio: { image: minio/minio, ... }
      steps:
        - run: pnpm --filter @skillhub/backend db:migrate
        - run: pnpm test:integration

    build-docker:
      needs: [unit-test]
      runs-on: ubuntu-latest
      steps:
        - uses: docker/build-push-action@v5
          with: { push: false, tags: skillhub-backend:ci }
  ```
- [P4-7.2] ESLint flat config (`eslint.config.js`):
  - TypeScript 推荐规则
  - Import 排序
  - 禁止 console.log (pino only)
- [P4-7.3] Prettier 配置
- [P4-7.4] 覆盖率门禁: 全局 ≥ 80%
- [P4-7.5] Conventional Commits 校验 (commitlint)
- [P4-7.6] 自动 Changelog 生成 (`changesets` 或 `semantic-release`)

---

## P4-8: 依赖管理

**复杂度：** 高

**子任务：**
- [P4-8.1] 定义 `skills.yaml` 格式:
  ```yaml
  dependencies:
    "@frontend/eslint-config": "latest"
    "@infra/docker-builder": "^1.0.0"
  ```
- [P4-8.2] `skillhub install` 解析 dependencies:
  - 从已安装 Skill 的 skills.yaml 读取 dependencies
  - 递归安装所有依赖 (广度优先)
  - 检测循环依赖
- [P4-8.3] 版本范围解析:
  - `latest` → 最新版本
  - `^1.0.0` → 兼容版本 (semver)
  - 精确版本 `1.2.3`
- [P4-8.4] 冲突检测:
  - 同一 Skill 的多个不兼容版本 → 报错
- [P4-8.5] `skillhub tree` 命令: 展示依赖树 (类似 `pnpm list --depth`)
- [P4-8.6] Push 时解析并存储 dependencies 到数据库

---

## P4-9: CLI 增强

**复杂度：** 中

**子任务：**
- [P4-9.1] `skillhub init`:
  - 交互式问答 (inquirer/prompts)
  - 生成 `SKILL.md` 模板 (含 Frontmatter)
  - 可选生成 `skills.yaml`
- [P4-9.2] `skillhub lint [dir]`:
  - 独立 lint 命令
  - 校验 SKILL.md Frontmatter 完整性
  - 校验 skills.yaml 格式 (若存在)
  - 输出详细错误报告
- [P4-9.3] `skillhub info @ns/name`:
  - 离线模式: 从缓存读取
  - 在线模式: 从 API 获取
- [P4-9.4] `skillhub list`:
  - 列出 `~/.skillhub/installed.json` 中的已安装技能
  - 表格: 名称、版本、安装时间、软链接路径
- [P4-9.5] `skillhub uninstall @ns/name`:
  - 删除缓存目录
  - 删除软链接
  - 从 installed.json 移除
- [P4-9.6] `skillhub config [key] [value]`:
  - 无参数: 显示全部配置
  - `skillhub config telemetry false`: 设置值
  - 类似 `git config` 的使用体验
- [P4-9.7] Shell 自动补全:
  - bash: `skillhub completion bash >> ~/.bashrc`
  - zsh: `skillhub completion zsh >> ~/.zshrc`
  - fish: `skillhub completion fish | source`
  - Commander.js 内置补全 + 自定义补全 (命名空间名、技能名)
- [P4-9.8] 版本更新检查:
  - CLI 启动时异步检查 npm registry
  - 有新版本时显示一次提示 (24 小时内不重复)

**单元测试 (12)：**
- init 生成正确模板 / lint 成功 / lint 失败
- info 离线 / info 在线
- list 有内容 / list 为空
- uninstall 成功 / uninstall 不存在
- config 读 / config 写
- completion 生成

---

## P4-10: 文档与生态

**复杂度：** 低

**子任务：**
- [P4-10.1] `SKILL.md` 编写指南:
  - Frontmatter 字段规范
  - 最佳实践
  - 示例模板
- [P4-10.2] CLI 文档站 (VitePress):
  - 安装指南
  - 命令参考
  - 教程 (从零发布第一个 Skill)
- [P4-10.3] API Reference:
  - OpenAPI 3.0 spec (从 Hono zod 路由自动生成)
  - Swagger UI 挂载到 `/api/docs`
- [P4-10.4] MCP 配置指南:
  - Claude Code 配置
  - Codex 配置
  - OpenClaw 配置
- [P4-10.5] `example-skills/` 示例仓库:
  - `hello-world`: 最简 Skill
  - `eslint-config`: 典型前端 Skill
  - `docker-deploy`: 典型运维 Skill
- [P4-10.6] `CONTRIBUTING.md`: 贡献指南

---

## 依赖关系与执行顺序

```
第 1 波 (可并行):
  P4-1 (RBAC) — 优先级最高
  P4-2 (安全加固) — 优先级最高
  P4-5 (可观测性)
  P4-7 (CI/CD)

第 2 波 (依赖第 1 波):
  P4-3 (审计日志) ← P4-1
  P4-4 (遥测) ← P4-2
  P4-6 (Docker 生产化)

第 3 波:
  P4-8 (依赖管理)
  P4-9 (CLI 增强)
  P4-10 (文档)
```

---

## 全量测试统计

| Phase | 单元测试数 | 集成测试数 |
|-------|-----------|-----------|
| Phase 1 | 45 | — |
| Phase 2 | ~64 | ~15 |
| Phase 3 | ~31 | ~8 |
| Phase 4 | ~54 | ~12 |
| **总计** | **~194** | **~35** |
