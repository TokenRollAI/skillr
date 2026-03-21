> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Skillhub 全阶段路线图 (Phase 2 ~ Phase 4)

> Phase 1 已完成：Monorepo 骨架、CLI 多源管理、认证命令、Docker Compose 基础设施、45 个单元测试全部通过。

---

## Phase 总览

```
Phase 1 ✅  CLI 骨架          — Monorepo + 多源管理 + Auth 命令 + 双态输出
Phase 2     Backend 核心       — 数据库 + API + Scan/Push/Install 全链路打通
Phase 3     Web UI + MCP      — 前端大盘 + MCP Gateway + 搜索发现
Phase 4     企业加固           — RBAC + 审计 + 遥测 + CI/CD + 生产部署
```

---

# Phase 2: Backend 核心 + CLI 全链路

**目标：** 让 `skillhub push` 和 `skillhub install` 端到端跑通——CLI 可以将本地 Skill 发布到 Backend，也可以从 Backend 拉取并安装到本地。

## 2.1 数据库 Schema + 迁移 (Drizzle ORM)

### Task P2-1: Drizzle ORM 集成与数据库 Schema

**新增文件：**
```
packages/backend/
├── src/models/
│   ├── schema.ts          # 统一导出
│   ├── user.ts            # users 表
│   ├── namespace.ts       # namespaces + ns_members 表
│   ├── skill.ts           # skills + skill_tags 表
│   └── device-code.ts     # device_codes 表 (认证流)
├── drizzle.config.ts      # Drizzle Kit 配置
└── drizzle/               # 自动生成的迁移文件
```

**Schema 定义：**

```sql
-- users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(64) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                -- 本地密码 (可选, OAuth 用户为 NULL)
  role        VARCHAR(20) DEFAULT 'viewer',  -- 'admin' | 'maintainer' | 'viewer'
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- namespaces
CREATE TABLE namespaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(64) UNIQUE NOT NULL,   -- @frontend, @data-infra
  description TEXT,
  visibility  VARCHAR(20) DEFAULT 'internal', -- 'public' | 'internal' | 'private'
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ns_members (命名空间成员, RBAC 核心)
CREATE TABLE ns_members (
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  namespace_id UUID REFERENCES namespaces(id) ON DELETE CASCADE,
  role         VARCHAR(20) DEFAULT 'viewer', -- 'maintainer' | 'viewer'
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, namespace_id)
);

-- skills
CREATE TABLE skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id UUID NOT NULL REFERENCES namespaces(id),
  name         VARCHAR(128) NOT NULL,
  description  TEXT,
  latest_tag   VARCHAR(64) DEFAULT 'latest',
  readme       TEXT,                         -- SKILL.md 原文
  dependencies JSONB DEFAULT '{}',           -- 预留: 未来依赖解析
  downloads    INTEGER DEFAULT 0,            -- 下载计数
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (namespace_id, name)
);

-- skill_tags (版本管理)
CREATE TABLE skill_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  tag          VARCHAR(64) NOT NULL,          -- 'latest', 'v1.0.0'
  artifact_key VARCHAR(512) NOT NULL,         -- S3 object key
  size_bytes   BIGINT NOT NULL,
  checksum     VARCHAR(128) NOT NULL,         -- sha256
  metadata     JSONB DEFAULT '{}',            -- frontmatter 解析结果
  published_by UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (skill_id, tag)
);

-- device_codes (认证流临时表)
CREATE TABLE device_codes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code      VARCHAR(128) UNIQUE NOT NULL,
  user_code        VARCHAR(16) UNIQUE NOT NULL,
  user_id          UUID REFERENCES users(id),  -- 认证完成后写入
  status           VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'approved' | 'expired'
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX idx_skills_namespace ON skills(namespace_id);
CREATE INDEX idx_skill_tags_skill ON skill_tags(skill_id);
CREATE INDEX idx_skills_fulltext ON skills USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

**子任务：**
- [P2-1.1] 安装依赖：`drizzle-orm`, `drizzle-kit`, `postgres` (pg driver), `dotenv`
- [P2-1.2] 编写 Drizzle schema (TypeScript 类型安全定义)
- [P2-1.3] 配置 `drizzle.config.ts`，连接 Docker PostgreSQL
- [P2-1.4] 生成并执行首次迁移 (`drizzle-kit generate` + `drizzle-kit migrate`)
- [P2-1.5] 编写 seed 脚本：创建默认 admin 用户 + 默认 namespace

**验收标准：**
- `pnpm --filter @skillhub/backend db:migrate` 成功在 Docker PG 中创建所有表
- `pnpm --filter @skillhub/backend db:seed` 创建种子数据
- Drizzle Studio (`drizzle-kit studio`) 可以浏览表结构

**单元测试：**
```
describe('database schema')
  ✓ users 表创建成功
  ✓ namespaces 表创建成功
  ✓ skills + skill_tags 外键关联正确
  ✓ ns_members 复合主键正确
  ✓ device_codes 表创建成功
  ✓ 全文索引可用
```

---

### Task P2-2: Backend API 框架 (Hono)

**新增文件：**
```
packages/backend/src/
├── index.ts              # Hono 应用入口
├── db.ts                 # 数据库连接池
├── env.ts                # 环境变量校验 (zod)
├── routes/
│   ├── auth.ts           # Device Code 流 + Token 校验
│   ├── skills.ts         # Skill CRUD + 搜索
│   ├── namespaces.ts     # Namespace CRUD
│   └── health.ts         # 健康检查端点
├── services/
│   ├── auth.service.ts   # 认证业务逻辑
│   ├── skill.service.ts  # 技能业务逻辑
│   └── storage.service.ts # S3/MinIO 操作
├── middleware/
│   ├── auth.ts           # JWT 校验中间件
│   ├── error-handler.ts  # 全局错误处理
│   └── logger.ts         # 请求日志
└── utils/
    └── jwt.ts            # JWT 签发与校验
```

**子任务：**
- [P2-2.1] 安装依赖：`hono`, `@hono/node-server`, `jose` (JWT), `zod`, `@aws-sdk/client-s3`
- [P2-2.2] 实现环境变量校验 (`env.ts`，使用 zod schema)
- [P2-2.3] 实现数据库连接池 (`db.ts`，基于 `postgres` 驱动 + drizzle)
- [P2-2.4] 实现全局中间件：error-handler, logger
- [P2-2.5] 实现 `GET /health` 端点
- [P2-2.6] Docker Compose 加入 backend 服务，自动连接 PG 和 MinIO
- [P2-2.7] Dockerfile.backend (multi-stage build)

**验收标准：**
- `pnpm --filter @skillhub/backend dev` 启动成功
- `curl http://localhost:3001/health` 返回 `{"status":"ok","db":"connected","s3":"connected"}`
- `docker compose up` 一键启动包含 backend 的完整栈

**单元测试：**
```
describe('backend core')
  ✓ 环境变量缺失时启动失败并报错
  ✓ GET /health 返回 200
  ✓ 未知路由返回 404
  ✓ 全局错误处理返回标准 JSON 错误格式
```

---

### Task P2-3: 认证 API (Device Code 流 + JWT)

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 用户注册 (用户名+密码+邮箱) |
| `POST` | `/api/auth/device/code` | 请求 Device Code |
| `GET` | `/api/auth/device/verify` | 浏览器端验证页面用 (返回 user_code 确认) |
| `POST` | `/api/auth/device/approve` | 用户确认授权 (浏览器端) |
| `POST` | `/api/auth/device/token` | CLI 轮询 token (Device Code Grant) |
| `POST` | `/api/auth/token` | 机器 Token 签发 |
| `GET` | `/api/auth/me` | 当前用户信息 |

**子任务：**
- [P2-3.1] 实现 `auth.service.ts`：用户注册、密码哈希 (argon2)、JWT 签发
- [P2-3.2] 实现 Device Code 流服务端：生成 8 位 user_code、存储到 device_codes 表、过期清理
- [P2-3.3] 实现 `POST /api/auth/device/code`：返回 device_code + user_code + verification_uri
- [P2-3.4] 实现 `POST /api/auth/device/approve`：验证 user_code，绑定 user_id，更新状态为 approved
- [P2-3.5] 实现 `POST /api/auth/device/token`：CLI 轮询端点，返回 JWT 或 pending/expired 状态
- [P2-3.6] 实现 `POST /api/auth/token`：Machine Token 签发 (admin 操作)
- [P2-3.7] 实现 JWT 中间件：解析 Authorization header，注入 user context
- [P2-3.8] 实现 `GET /api/auth/me`

**验收标准：**
- CLI `auth login` 可以与真实 Backend 完成 Device Code 流程
- JWT 包含 user_id、username、role
- Token 过期后自动拒绝
- Machine Token 可通过 `SKILLHUB_TOKEN` 环境变量使用

**单元测试：**
```
describe('auth API')
  ✓ POST /api/auth/register - 成功注册
  ✓ POST /api/auth/register - 重复用户名拒绝
  ✓ POST /api/auth/device/code - 返回有效 device_code
  ✓ POST /api/auth/device/approve - 成功批准
  ✓ POST /api/auth/device/token - pending 状态返回 authorization_pending
  ✓ POST /api/auth/device/token - approved 后返回 access_token
  ✓ POST /api/auth/device/token - 过期后返回 expired_token
  ✓ GET /api/auth/me - 有效 token 返回用户信息
  ✓ GET /api/auth/me - 无效 token 返回 401
```

---

### Task P2-4: S3 存储服务

**子任务：**
- [P2-4.1] 实现 `storage.service.ts`：封装 @aws-sdk/client-s3
- [P2-4.2] 实现 `uploadArtifact(key, buffer, metadata)`：上传 tarball 到 MinIO/S3
- [P2-4.3] 实现 `downloadArtifact(key)`：返回 ReadableStream
- [P2-4.4] 实现 `getSignedUrl(key, expiresIn)`：生成预签名下载 URL (用于 CLI 直接从 S3 拉取)
- [P2-4.5] 实现 `deleteArtifact(key)`：删除制品

**验收标准：**
- 上传后可通过 MinIO Console 看到对象
- 下载的文件与上传的完全一致 (sha256 校验)
- 预签名 URL 可直接用 curl 下载

**单元测试：**
```
describe('storage service')
  ✓ uploadArtifact - 上传成功并返回 key
  ✓ downloadArtifact - 下载内容与上传一致
  ✓ getSignedUrl - 返回有效的预签名 URL
  ✓ deleteArtifact - 删除后再下载返回 404
```

---

### Task P2-5: 技能 API (CRUD + 搜索)

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/skills/@:ns/:name` | 创建/更新技能 (push) |
| `GET` | `/api/skills/@:ns/:name` | 获取技能详情 |
| `GET` | `/api/skills/@:ns/:name/tags` | 列出所有 tags |
| `GET` | `/api/skills/@:ns/:name/tags/:tag` | 获取特定 tag 详情 (含下载地址) |
| `GET` | `/api/skills/search?q=xxx` | 全文搜索 |
| `GET` | `/api/skills` | 列出技能 (分页) |
| `DELETE` | `/api/skills/@:ns/:name` | 删除技能 (admin/maintainer) |

**子任务：**
- [P2-5.1] 实现 `skill.service.ts`：Skill 创建、更新、查询、搜索、删除
- [P2-5.2] 实现 `POST /api/skills/@:ns/:name`：接收 tarball + metadata，存储到 S3，更新数据库
- [P2-5.3] 实现 `GET /api/skills/@:ns/:name`：返回 Skill 详情 + 最新 tag
- [P2-5.4] 实现 `GET /api/skills/@:ns/:name/tags/:tag`：返回特定版本详情 + S3 预签名下载 URL
- [P2-5.5] 实现 `GET /api/skills/search?q=xxx`：PostgreSQL 全文搜索
- [P2-5.6] 实现列表分页 (`GET /api/skills?page=1&limit=20&ns=@frontend`)
- [P2-5.7] 实现 `DELETE /api/skills/@:ns/:name`

**验收标准：**
- Push 一个 Skill tarball 后，可通过 API 搜到并下载
- 全文搜索支持中文和英文
- 分页参数正确控制返回数量
- 删除后搜索和下载均返回 404

**单元测试：**
```
describe('skills API')
  ✓ POST - 成功创建 Skill
  ✓ POST - 相同 tag 覆盖更新
  ✓ POST - 不同 tag 追加版本
  ✓ GET - 返回 Skill 详情
  ✓ GET tags - 列出所有版本
  ✓ GET tag - 返回含下载 URL 的版本详情
  ✓ search - 搜索命中正确结果
  ✓ search - 无结果返回空数组
  ✓ list - 分页参数正确
  ✓ DELETE - 成功删除
  ✓ DELETE - 非 maintainer 返回 403
```

---

### Task P2-6: Namespace API

**API 端点：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/namespaces` | 创建命名空间 |
| `GET` | `/api/namespaces` | 列出命名空间 |
| `GET` | `/api/namespaces/@:name` | 获取命名空间详情 |
| `PUT` | `/api/namespaces/@:name` | 更新命名空间 |
| `POST` | `/api/namespaces/@:name/members` | 添加成员 |
| `DELETE` | `/api/namespaces/@:name/members/:userId` | 移除成员 |

**子任务：**
- [P2-6.1] 实现 Namespace CRUD
- [P2-6.2] 实现成员管理 (添加/移除/列出)
- [P2-6.3] 创建命名空间时自动将创建者设为 maintainer

**单元测试：** 8 个测试覆盖 CRUD + 成员管理 + 权限检查

---

### Task P2-7: CLI scan 命令

**命令：** `skillhub scan [directory]`

**逻辑：**
1. 递归遍历指定目录（默认 `.`），忽略 `.git`, `node_modules`, `dist` 等
2. 查找包含 `SKILL.md` 的目录
3. 解析 `SKILL.md` 的 YAML Frontmatter（提取 name, description, version 等）
4. 若已认证，对比云端状态（调用 `GET /api/skills/@ns/name`）
5. 输出报告："发现 N 个本地 Skill，M 个未发布，K 个需要更新"

**子任务：**
- [P2-7.1] 实现目录遍历 + 忽略规则 (使用 `fast-glob`)
- [P2-7.2] 实现 `SKILL.md` YAML Frontmatter 解析 (使用 `gray-matter`)
- [P2-7.3] 实现 Frontmatter Lint（必备字段校验：name, description）
- [P2-7.4] 实现云端状态对比
- [P2-7.5] 人机双态输出报告

**单元测试：**
```
describe('scan command')
  ✓ 发现包含 SKILL.md 的目录
  ✓ 忽略 node_modules 和 .git
  ✓ 解析 YAML Frontmatter 提取 name 和 description
  ✓ 缺少必备字段时标记为 lint error
  ✓ 无 SKILL.md 时输出 "未发现任何 Skill"
  ✓ --json 输出合法 JSON
```

---

### Task P2-8: CLI push 命令

**命令：** `skillhub push @namespace/skill-name [-t tag]`

**逻辑：**
1. 定位当前目录（或参数指定）的 `SKILL.md`
2. Lint 校验 Frontmatter
3. 打包目录为 `.tar.gz`（排除 `.git`, `node_modules`）
4. 计算 sha256 checksum
5. 上传 tarball 到 Backend `POST /api/skills/@ns/name`
6. 输出发布结果

**子任务：**
- [P2-8.1] 实现 tarball 打包 (使用 `tar` 库)
- [P2-8.2] 实现 sha256 checksum 计算
- [P2-8.3] 实现 multipart/form-data 上传到 Backend
- [P2-8.4] 实现进度条显示 (TTY 模式)
- [P2-8.5] 集成 lint 预检

**单元测试：**
```
describe('push command')
  ✓ 成功打包并上传
  ✓ Lint 失败时阻止发布
  ✓ 网络错误时友好提示
  ✓ --json 输出发布结果
  ✓ 无认证时提示登录
```

---

### Task P2-9: CLI install + update 命令

**命令：**
- `skillhub install @namespace/skill-name [-t tag]`
- `skillhub update [@namespace/skill-name]`

**逻辑 (install)：**
1. 调用 `GET /api/skills/@ns/name/tags/tag` 获取下载 URL
2. 从 S3 预签名 URL 下载 tarball
3. 校验 checksum
4. 解压到全局缓存 `~/.skillhub/cache/@namespace/skill-name/`
5. **Symlink Magic：** 探测当前目录环境，创建软链接
   - `.claude/` → `.claude/skills/@namespace/skill-name`
   - `.agents/` → `.agents/skills/@namespace/skill-name`
6. 记录已安装列表到 `~/.skillhub/installed.json`

**逻辑 (update)：**
1. 读取 `~/.skillhub/installed.json`
2. 对每个已安装 Skill，查询 latest tag
3. 若有新版本，重新 install

**子任务：**
- [P2-9.1] 实现 tarball 下载 + 流式校验 (边下载边计算 sha256)
- [P2-9.2] 实现解压到缓存目录
- [P2-9.3] 实现 Symlink 自动探测 + 创建 (`packages/cli/src/lib/symlink.ts`)
- [P2-9.4] 实现 `installed.json` 安装记录管理
- [P2-9.5] 实现 `update` 命令的批量更新逻辑
- [P2-9.6] 进度条显示

**单元测试：**
```
describe('install command')
  ✓ 下载并解压到缓存
  ✓ checksum 校验失败时报错
  ✓ .claude/ 存在时创建正确软链接
  ✓ .agents/ 存在时创建正确软链接
  ✓ 重复安装覆盖旧版本
  ✓ 记录到 installed.json
describe('update command')
  ✓ 发现可更新的 Skill
  ✓ 已是最新时提示无更新
  ✓ 批量更新多个 Skill
```

---

### Task P2-10: CLI + Backend 端到端集成测试

**子任务：**
- [P2-10.1] 编写 E2E 测试脚本 (需要 Docker 环境)
- [P2-10.2] 完整流程：register → login → create namespace → scan → push → install → update
- [P2-10.3] 添加到 CI workflow (使用 docker compose)

**验收流程：**
```bash
# 1. 启动全栈
docker compose up -d

# 2. 注册用户
curl -X POST http://localhost:3001/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","email":"test@test.com","password":"test123"}'

# 3. CLI 登录
skillhub auth login

# 4. 创建命名空间
curl -X POST http://localhost:3001/api/namespaces \
  -H 'Authorization: Bearer <token>' \
  -d '{"name":"@test"}'

# 5. 扫描本地
skillhub scan ./example-skills/

# 6. 发布
skillhub push @test/hello-world -t v1.0.0

# 7. 安装
mkdir test-project && cd test-project && mkdir .claude
skillhub install @test/hello-world
ls -la .claude/skills/@test/hello-world  # 验证软链接

# 8. 搜索
skillhub search "hello"
```

---

## Phase 2 依赖关系

```
P2-1 (Schema)
 └── P2-2 (Backend 框架) ──────────────────┐
      ├── P2-3 (Auth API)                   │
      ├── P2-4 (S3 存储) ──┐               │
      ├── P2-5 (Skills API) ←──── P2-4     │
      └── P2-6 (Namespace API)              │
                                             │
P2-7 (CLI scan) ─── 独立，不依赖 Backend    │
P2-8 (CLI push) ←── P2-3, P2-5             │
P2-9 (CLI install) ←── P2-5                │
P2-10 (E2E) ←── 全部                       │
```

---

# Phase 3: Web UI + MCP Gateway

**目标：** 提供可视化的技能浏览/搜索 Web 界面和 MCP 协议支持，让 Agent 可以动态发现技能。

## 3.1 Web UI (Next.js 15 + Tailwind CSS)

### Task P3-1: 前端基础搭建

**子任务：**
- [P3-1.1] 初始化 Next.js 15 (App Router) + Tailwind CSS v4
- [P3-1.2] 设计系统：暗黑模式、极客风、等宽字体排版
- [P3-1.3] 全局布局：顶部导航 + 侧边栏 + 主内容区
- [P3-1.4] API Client 封装 (fetch wrapper, 自动附加 token)
- [P3-1.5] 全局状态管理 (Zustand：用户会话、主题)

**设计原则 (来自 PRD)：**
- 极客风 (Geek Chic)、暗黑模式为主
- 高对比度、等宽字体 (JetBrains Mono / Fira Code)
- 强调搜索和 CLI 命令的一键复制
- 终端风格的代码块和命令展示

---

### Task P3-2: 技能浏览与搜索页

**页面：**
- `/` — 首页：搜索框 + 热门技能 + 最近更新
- `/skills` — 技能列表（分页、筛选、排序）
- `/skills/@:ns/:name` — 技能详情页
  - README 渲染 (SKILL.md → Markdown)
  - 版本列表 (Tags)
  - 安装命令一键复制：`skillhub install @ns/name`
  - 下载统计、最后更新时间
- `/skills/@:ns/:name/versions` — 版本历史

**子任务：**
- [P3-2.1] 首页：搜索框 (Command+K 全局快捷键) + 热门技能卡片
- [P3-2.2] 技能列表页：表格/卡片视图切换、搜索、命名空间筛选
- [P3-2.3] 技能详情页：Markdown 渲染、版本选择、安装命令复制
- [P3-2.4] 服务端数据获取 (RSC + Server Actions)
- [P3-2.5] 响应式设计

**验收标准：**
- 搜索框输入后 200ms debounce 触发搜索
- 安装命令一键复制到剪贴板
- Markdown 正确渲染代码块、表格、链接
- 暗黑模式下阅读体验良好

---

### Task P3-3: 用户与认证页面

**页面：**
- `/login` — 登录页
- `/register` — 注册页
- `/device` — Device Code 验证页 (CLI auth login 引导到此页面)
- `/settings` — 用户设置
- `/settings/tokens` — Machine Token 管理

**子任务：**
- [P3-3.1] 登录/注册表单 (username + password)
- [P3-3.2] Device Code 验证页：输入 user_code，确认授权
- [P3-3.3] 用户设置页：个人信息修改、密码修改
- [P3-3.4] Machine Token 管理：创建、列出、撤销
- [P3-3.5] NextAuth.js 或自建 Session 管理

---

### Task P3-4: 命名空间管理页

**页面：**
- `/namespaces` — 命名空间列表
- `/namespaces/@:name` — 命名空间详情 (成员列表、技能列表)
- `/namespaces/@:name/settings` — 命名空间设置 (可见性、成员管理)

**子任务：**
- [P3-4.1] 命名空间列表页
- [P3-4.2] 命名空间详情：成员列表 + 技能列表
- [P3-4.3] 成员管理界面：邀请、角色变更、移除
- [P3-4.4] 命名空间创建/编辑表单

---

### Task P3-5: 管理后台 (Admin Dashboard)

**页面：**
- `/admin` — 管理面板 (仅 Global Admin 可见)
- `/admin/users` — 用户管理
- `/admin/namespaces` — 命名空间管理
- `/admin/skills` — 技能管理 (全局视图)

---

## 3.2 MCP Gateway

### Task P3-6: MCP Server (mcp-skillhub)

**位置：** `packages/backend/src/mcp/server.ts`

**MCP 工具列表：**

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `search_skills` | `{ query: string, namespace?: string, limit?: number }` | 搜索技能 |
| `get_skill_info` | `{ namespace: string, name: string, tag?: string }` | 获取技能详情 |
| `list_namespaces` | `{}` | 列出可用命名空间 |
| `get_install_instructions` | `{ namespace: string, name: string }` | 获取安装说明 |

**子任务：**
- [P3-6.1] 安装 `@modelcontextprotocol/sdk`
- [P3-6.2] 实现 MCP Server 骨架 (stdio transport)
- [P3-6.3] 实现 `search_skills` 工具：调用后端搜索 API
- [P3-6.4] 实现 `get_skill_info` 工具：返回技能详情 + SKILL.md 内容
- [P3-6.5] 实现 `list_namespaces` 工具
- [P3-6.6] 实现 `get_install_instructions` 工具：返回安装命令和使用说明
- [P3-6.7] 打包为独立可执行：`npx mcp-skillhub`
- [P3-6.8] 编写配置文档：如何添加到 Claude Code / Codex 的 MCP 配置

**验收标准：**
- Agent 通过 MCP 协议调用 `search_skills` 返回正确结果
- 返回的技能信息包含完整的安装和使用说明
- 在 Claude Code 中配置后可正常工作

**单元测试：**
```
describe('MCP Gateway')
  ✓ search_skills - 返回匹配的技能列表
  ✓ search_skills - 空查询返回热门技能
  ✓ get_skill_info - 返回完整技能信息
  ✓ get_skill_info - 不存在的技能返回错误
  ✓ list_namespaces - 返回命名空间列表
  ✓ get_install_instructions - 返回格式化的安装命令
```

---

### Task P3-7: CLI search 命令

**命令：** `skillhub search <query> [--namespace @ns] [--limit N]`

**子任务：**
- [P3-7.1] 实现搜索命令，调用 Backend 搜索 API
- [P3-7.2] 表格输出：名称、描述、版本、下载量
- [P3-7.3] `--json` 输出搜索结果

---

## Phase 3 依赖关系

```
P3-1 (前端基础) ─── 独立
 ├── P3-2 (技能浏览) ←── P3-1
 ├── P3-3 (用户认证) ←── P3-1
 ├── P3-4 (命名空间) ←── P3-1
 └── P3-5 (管理后台) ←── P3-1, P3-3

P3-6 (MCP Gateway) ←── Phase 2 Backend
P3-7 (CLI search) ←── Phase 2 Backend
```

---

# Phase 4: 企业加固与生产就绪

**目标：** 将 Skillhub 从"能跑"提升为"能用于生产的企业级平台"。

## 4.1 安全与权限

### Task P4-1: 完整 RBAC 系统

**子任务：**
- [P4-1.1] 实现 RBAC 中间件：Global Admin / Namespace Maintainer / Viewer 三级权限
- [P4-1.2] Push 权限检查：只有 Namespace Maintainer 可以 push 到对应命名空间
- [P4-1.3] 私有命名空间：`visibility: 'private'` 的命名空间只有成员可见
- [P4-1.4] Admin API：用户角色提升/降级
- [P4-1.5] 前端权限 UI：根据角色隐藏/禁用操作按钮

**单元测试：**
```
describe('RBAC')
  ✓ Viewer 不能 push
  ✓ Maintainer 可以 push 到自己的命名空间
  ✓ Maintainer 不能 push 到其他命名空间
  ✓ Admin 可以 push 到任何命名空间
  ✓ Private 命名空间对非成员不可见
  ✓ Admin 可以提升/降级用户角色
```

---

### Task P4-2: 安全加固

**子任务：**
- [P4-2.1] Rate Limiting：API 全局限流 (hono-rate-limiter)
- [P4-2.2] CORS 配置：限制前端域名
- [P4-2.3] 输入校验加固：所有 API 参数用 zod 严格校验
- [P4-2.4] SQL 注入防护验证 (Drizzle ORM 天然防护，编写验证测试)
- [P4-2.5] Tarball 安全扫描：限制文件大小、禁止符号链接攻击 (zip slip)
- [P4-2.6] SKILL.md 内容安全：XSS 防护 (Markdown 渲染时 sanitize)
- [P4-2.7] Token 吊销机制：revoked_tokens 黑名单表
- [P4-2.8] Helmet 安全头 (CSP, HSTS 等)

---

### Task P4-3: 审计日志

**新增表：**
```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(64) NOT NULL,    -- 'skill.push', 'skill.delete', 'namespace.create' 等
  resource    VARCHAR(255),            -- '@frontend/deploy-helper'
  details     JSONB,                   -- 额外信息
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_time ON audit_logs(created_at);
```

**子任务：**
- [P4-3.1] 实现审计日志中间件：自动记录 mutation 操作
- [P4-3.2] Admin 审计日志查询 API
- [P4-3.3] 前端审计日志浏览页面
- [P4-3.4] 定期清理过期审计日志 (配置保留天数)

---

## 4.2 遥测与可观测性

### Task P4-4: 遥测系统 (Telemetry)

**子任务：**
- [P4-4.1] CLI 使用上报：安装、push、search 等命令的匿名统计 (可通过 `telemetry: false` 关闭)
- [P4-4.2] Backend 收集端点：`POST /api/telemetry/events`
- [P4-4.3] 下载计数：每次 install 时 `skills.downloads += 1`
- [P4-4.4] Web UI 数据面板："企业内最受欢迎的 10 大 AI 技能"
- [P4-4.5] 命名空间统计：技能数、总下载量、活跃度

---

### Task P4-5: 可观测性 (Observability)

**子任务：**
- [P4-5.1] 结构化日志：pino (JSON 格式日志)
- [P4-5.2] Prometheus 指标暴露：`/metrics` 端点
  - 请求延迟 (histogram)
  - 请求计数 (counter)
  - 活跃连接数 (gauge)
  - S3 操作延迟
- [P4-5.3] Docker Compose 加入 Prometheus + Grafana (可选)
- [P4-5.4] 健康检查增强：包含数据库连接池状态、S3 可达性

---

## 4.3 生产部署

### Task P4-6: Docker 生产化

**子任务：**
- [P4-6.1] Backend 多阶段构建 Dockerfile (builder → runner, node:22-alpine)
- [P4-6.2] Frontend 多阶段构建 Dockerfile (standalone output)
- [P4-6.3] 生产 Docker Compose (含 nginx 反向代理)
- [P4-6.4] 环境变量文档化：所有可配置项列表
- [P4-6.5] 数据库自动迁移：容器启动时自动执行 `drizzle-kit migrate`

**docker-compose.prod.yml 架构：**
```yaml
services:
  nginx:        # 反向代理, SSL 终结, 端口 80/443
  backend:      # Hono API (2 replicas)
  frontend:     # Next.js standalone
  postgres:     # PostgreSQL 16 (持久化卷)
  minio:        # MinIO (持久化卷)
  minio-init:   # 初始化 bucket
```

---

### Task P4-7: CI/CD Pipeline

**`.github/workflows/ci.yml`：**

```yaml
name: CI
on: [push, pull_request]
jobs:
  lint:
    steps:
      - pnpm lint
  typecheck:
    steps:
      - pnpm typecheck
  unit-test:
    steps:
      - pnpm test
      - 覆盖率 ≥ 80%
  integration-test:
    services: [postgres, minio]
    steps:
      - db:migrate
      - pnpm test:integration
  build:
    steps:
      - docker build backend
      - docker build frontend
  e2e-test:
    needs: [build]
    steps:
      - docker compose up
      - 运行 E2E 测试套件
      - docker compose down
```

**子任务：**
- [P4-7.1] 编写 CI workflow (GitHub Actions)
- [P4-7.2] 编写 lint 配置 (ESLint flat config)
- [P4-7.3] 覆盖率门禁 (Vitest coverage + threshold)
- [P4-7.4] Docker 镜像构建 + 缓存
- [P4-7.5] 自动 changelog 生成 (conventional commits)

---

### Task P4-8: 依赖管理 (预留功能激活)

**子任务：**
- [P4-8.1] 定义 `skills.yaml` 格式规范
  ```yaml
  # skills.yaml
  dependencies:
    - "@frontend/eslint-config": "^1.0.0"
    - "@infra/docker-builder": "latest"
  ```
- [P4-8.2] 实现 `skillhub install` 时递归解析 dependencies
- [P4-8.3] 实现依赖冲突检测
- [P4-8.4] 实现 `skillhub tree` 命令：展示依赖树

---

## 4.4 开发者体验 (DX)

### Task P4-9: CLI 增强

**子任务：**
- [P4-9.1] `skillhub init` — 交互式创建 `SKILL.md` 模板
- [P4-9.2] `skillhub lint` — 独立 lint 命令，校验 SKILL.md 格式
- [P4-9.3] `skillhub info @ns/name` — 查看技能详情 (离线模式从缓存读取)
- [P4-9.4] `skillhub list` — 列出本地已安装的技能
- [P4-9.5] `skillhub uninstall @ns/name` — 卸载技能 (删除缓存+软链接)
- [P4-9.6] `skillhub config` — 查看/编辑配置 (类似 git config)
- [P4-9.7] Shell 自动补全 (bash/zsh/fish)
- [P4-9.8] 自动更新检查：CLI 启动时检查是否有新版本

---

### Task P4-10: 文档与生态

**子任务：**
- [P4-10.1] 编写 `SKILL.md` 编写指南 (Open Agent Skills Standard)
- [P4-10.2] 编写 CLI 使用文档 (docusaurus 或 VitePress)
- [P4-10.3] 编写 API Reference (OpenAPI spec, 自动生成)
- [P4-10.4] 编写 MCP 配置指南 (Claude Code / Codex / OpenClaw)
- [P4-10.5] 创建 example-skills 示例仓库
- [P4-10.6] 编写 CONTRIBUTING.md

---

# 全阶段里程碑总结

| Phase | 里程碑 | 核心能力 |
|-------|--------|----------|
| **Phase 1** ✅ | CLI 骨架 | 多源管理、认证命令、人机双态输出 |
| **Phase 2** | 全链路打通 | Backend API + DB + scan/push/install 端到端 |
| **Phase 3** | 可视化 + Agent 自治 | Web UI 技能浏览 + MCP Gateway |
| **Phase 4** | 企业级生产 | RBAC + 审计 + 遥测 + CI/CD + 生产部署 |

**Phase 2 完成后：** 开发者可以 scan → push → install 完整流程
**Phase 3 完成后：** 非 CLI 用户可以通过 Web 浏览，Agent 可以动态发现技能
**Phase 4 完成后：** 可安全地部署到企业生产环境，支持团队协作和审计

---

# 附录：全量 CLI 命令列表

```
skillhub --version                       # 版本号
skillhub --help                          # 帮助

# 认证
skillhub auth login [--source <name>]    # Device Code 登录
skillhub auth logout [--source <name>]   # 登出
skillhub auth whoami [--source <name>]   # 当前用户
skillhub auth status                     # 所有源认证状态

# 多源管理
skillhub source list                     # 列出源
skillhub source add <name> <url>         # 添加源
skillhub source remove <name>            # 移除源
skillhub source set-default <name>       # 设置默认源

# 技能管理 (Phase 2)
skillhub scan [dir]                      # 扫描本地 Skill
skillhub push @ns/name [-t tag]          # 发布
skillhub install @ns/name [-t tag]       # 安装
skillhub update [@ns/name]               # 更新
skillhub search <query>                  # 搜索 (Phase 3)

# DX 增强 (Phase 4)
skillhub init                            # 创建 SKILL.md 模板
skillhub lint [dir]                      # Lint 校验
skillhub info @ns/name                   # 技能详情
skillhub list                            # 已安装列表
skillhub uninstall @ns/name              # 卸载
skillhub config [key] [value]            # 配置管理
```
