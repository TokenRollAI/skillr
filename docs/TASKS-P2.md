# Phase 2 任务分解 — Backend 核心 + CLI 全链路

## 总览

Phase 2 的目标是让 `skillhub push` 和 `skillhub install` 端到端跑通。

**前置条件：** Phase 1 全部完成 ✅

---

## P2-1: Drizzle ORM 集成与数据库 Schema

**复杂度：** 中

**子任务：**
- [P2-1.1] 安装 `drizzle-orm`, `drizzle-kit`, `postgres`, `dotenv`, `argon2`, `zod`
- [P2-1.2] 编写 `packages/backend/src/models/` 下所有 Drizzle schema
  - `user.ts`: users 表
  - `namespace.ts`: namespaces + ns_members 表
  - `skill.ts`: skills + skill_tags 表
  - `device-code.ts`: device_codes 表
  - `schema.ts`: 统一导出
- [P2-1.3] 编写 `drizzle.config.ts`
- [P2-1.4] 编写 `packages/backend/src/db.ts` 数据库连接池
- [P2-1.5] 生成首次迁移 `drizzle-kit generate`
- [P2-1.6] 编写 seed 脚本 `packages/backend/src/seed.ts`
- [P2-1.7] 添加 scripts: `db:migrate`, `db:seed`, `db:studio`

**验收标准：**
- `pnpm --filter @skillhub/backend db:migrate` 在 Docker PG 中创建所有表
- `pnpm --filter @skillhub/backend db:seed` 创建 admin + 默认 namespace
- `drizzle-kit studio` 可浏览

**单元测试 (6)：**
- 所有表创建成功
- 外键约束正确
- UNIQUE 约束正确
- 全文索引生效
- seed 数据可查询
- 连接池正常工作

---

## P2-2: Backend Hono 框架

**复杂度：** 中

**子任务：**
- [P2-2.1] 安装 `hono`, `@hono/node-server`, `jose`, `zod`
- [P2-2.2] 实现 `packages/backend/src/env.ts` (zod 环境变量校验)
- [P2-2.3] 实现 `packages/backend/src/index.ts` (Hono 应用入口)
- [P2-2.4] 实现 `middleware/error-handler.ts` (统一 JSON 错误格式)
- [P2-2.5] 实现 `middleware/logger.ts` (请求日志)
- [P2-2.6] 实现 `routes/health.ts` (`GET /health`)
- [P2-2.7] 编写 `docker/Dockerfile.backend` (多阶段构建)
- [P2-2.8] 更新 `docker/docker-compose.yml` 加入 backend 服务

**验收标准：**
- `pnpm --filter @skillhub/backend dev` 启动成功
- `GET /health` 返回 `{"status":"ok","db":"connected","s3":"connected"}`
- `docker compose up` 包含 backend 并可访问

**单元测试 (4)：**
- 环境变量缺失时报错
- GET /health 返回 200
- 未知路由返回 404
- 错误处理返回标准 JSON

---

## P2-3: 认证 API

**复杂度：** 高

**子任务：**
- [P2-3.1] 实现 `services/auth.service.ts` (注册、密码哈希、JWT 签发/校验)
- [P2-3.2] 实现 `utils/jwt.ts` (jose 封装)
- [P2-3.3] 实现 `middleware/auth.ts` (JWT 中间件)
- [P2-3.4] 实现 Device Code 服务端逻辑 (生成/存储/轮询/过期)
- [P2-3.5] 实现路由:
  - `POST /api/auth/register`
  - `POST /api/auth/device/code`
  - `POST /api/auth/device/approve`
  - `POST /api/auth/device/token`
  - `POST /api/auth/token` (Machine Token)
  - `GET /api/auth/me`
- [P2-3.6] 过期 device_code 自动清理 (定时或惰性清理)

**验收标准：**
- CLI `auth login` 与 Backend 完成完整 Device Code 流
- JWT 过期后 401
- Machine Token 可通过 `SKILLHUB_TOKEN` 使用

**单元测试 (9)：**
- 注册成功 / 重复用户名拒绝
- Device Code 生成 / 批准 / 轮询成功 / 轮询过期
- JWT 签发 / 校验 / 过期
- GET /me 有效 token / 无效 token

---

## P2-4: S3 存储服务

**复杂度：** 中

**子任务：**
- [P2-4.1] 安装 `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- [P2-4.2] 实现 `services/storage.service.ts`
  - `uploadArtifact(key, buffer, metadata)` → void
  - `downloadArtifact(key)` → ReadableStream
  - `getSignedUrl(key, expiresIn)` → string
  - `deleteArtifact(key)` → void
  - `artifactExists(key)` → boolean

**验收标准：**
- 上传后 MinIO Console 可见
- 下载内容 sha256 一致
- 预签名 URL 可用 curl 下载

**单元测试 (5)：**
- 上传 / 下载 / 预签名 / 删除 / 存在性检查

---

## P2-5: 技能 API

**复杂度：** 高

**子任务：**
- [P2-5.1] 实现 `services/skill.service.ts`
- [P2-5.2] 实现路由:
  - `POST /api/skills/@:ns/:name` (push: 接收 tarball)
  - `GET /api/skills/@:ns/:name` (详情)
  - `GET /api/skills/@:ns/:name/tags` (tag 列表)
  - `GET /api/skills/@:ns/:name/tags/:tag` (tag 详情 + 下载 URL)
  - `GET /api/skills/search?q=xxx` (全文搜索)
  - `GET /api/skills?page=1&limit=20` (分页列表)
  - `DELETE /api/skills/@:ns/:name` (删除)
- [P2-5.3] Push 逻辑: 接收 multipart → 存储到 S3 → 更新数据库
- [P2-5.4] 全文搜索: PostgreSQL GIN 索引

**验收标准：**
- Push → 搜索 → 下载 全链路通
- 全文搜索支持部分匹配
- 分页正确

**单元测试 (11)：**
- 参见 ROADMAP.md P2-5 测试列表

---

## P2-6: Namespace API

**复杂度：** 中

**子任务：**
- [P2-6.1] 实现 CRUD 路由
- [P2-6.2] 实现成员管理路由
- [P2-6.3] 创建时自动设创建者为 maintainer

**单元测试 (8)：**
- CRUD 各 2 个 + 成员管理 4 个

---

## P2-7: CLI scan 命令

**复杂度：** 中

**新增依赖：** `fast-glob`, `gray-matter`

**子任务：**
- [P2-7.1] 目录遍历 + 忽略规则
- [P2-7.2] SKILL.md Frontmatter 解析
- [P2-7.3] Frontmatter Lint
- [P2-7.4] 云端状态对比 (已认证时)
- [P2-7.5] 双态输出

**单元测试 (6)：**
- 发现 SKILL.md / 忽略 node_modules / 解析 Frontmatter / Lint 错误 / 无结果 / --json

---

## P2-8: CLI push 命令

**复杂度：** 高

**新增依赖：** `tar`

**子任务：**
- [P2-8.1] tarball 打包
- [P2-8.2] sha256 计算
- [P2-8.3] multipart 上传
- [P2-8.4] 进度条
- [P2-8.5] lint 预检集成

**单元测试 (5)：**
- 成功打包上传 / Lint 失败阻止 / 网络错误 / --json / 无认证提示

---

## P2-9: CLI install + update 命令

**复杂度：** 高

**子任务：**
- [P2-9.1] tarball 下载 + 流式 sha256 校验
- [P2-9.2] 解压到 `~/.skillhub/cache/`
- [P2-9.3] Symlink 自动探测 + 创建
- [P2-9.4] `installed.json` 管理
- [P2-9.5] update 批量更新逻辑
- [P2-9.6] 进度条

**单元测试 (9)：**
- 下载解压 / checksum 失败 / symlink .claude / symlink .agents / 重复安装 / installed.json / 可更新 / 无更新 / 批量更新

---

## P2-10: 端到端集成测试

**复杂度：** 高

**子任务：**
- [P2-10.1] E2E 测试框架 (需 Docker)
- [P2-10.2] 完整流程: register → login → namespace → scan → push → install → update
- [P2-10.3] CI workflow 集成

---

## 依赖关系与执行顺序

```
第 1 波 (并行):
  P2-1 (Schema)
  P2-7 (CLI scan) — 独立，无 Backend 依赖

第 2 波 (依赖 P2-1):
  P2-2 (Backend 框架)

第 3 波 (依赖 P2-2, 可并行):
  P2-3 (Auth API)
  P2-4 (S3 存储)
  P2-6 (Namespace API)

第 4 波 (依赖 P2-3 + P2-4):
  P2-5 (Skills API)

第 5 波 (依赖 P2-5, 可并行):
  P2-8 (CLI push)
  P2-9 (CLI install)

第 6 波:
  P2-10 (E2E)
```
