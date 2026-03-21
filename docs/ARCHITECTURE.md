> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Skillhub 架构设计文档

## 1. 项目概述

Skillhub 是一个企业级 AI Agent 技能聚合与分发中心，遵循 Open Agent Skills Standard，为 Claude Code、Codex、OpenClaw 等 AI 编程助手提供统一的技能发现、聚合、分发与复用平台。

## 2. Monorepo 结构

```
skillhub/
├── packages/
│   ├── cli/                    # CLI 工具 (skillhub)
│   │   ├── src/
│   │   │   ├── commands/       # Commander.js 命令模块
│   │   │   │   ├── auth.ts     # auth login / auth logout / auth whoami
│   │   │   │   ├── source.ts   # source list / source add / source remove
│   │   │   │   ├── scan.ts     # 本地技能扫描
│   │   │   │   ├── push.ts     # 发布技能
│   │   │   │   ├── install.ts  # 安装技能
│   │   │   │   └── update.ts   # 更新技能
│   │   │   ├── lib/
│   │   │   │   ├── config.ts   # 配置管理 (~/.skillhub/config.json)
│   │   │   │   ├── registry-client.ts  # Registry HTTP 客户端
│   │   │   │   ├── auth-store.ts       # Token 持久化存储
│   │   │   │   ├── output.ts   # 人机双态输出 (TTY/JSON)
│   │   │   │   └── symlink.ts  # Symlink 自动探测与创建
│   │   │   ├── types/
│   │   │   │   └── index.ts    # CLI 层类型定义
│   │   │   └── index.ts        # 入口: Commander program 定义
│   │   ├── tests/              # 单元测试 + 集成测试
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── backend/                # 服务端 API
│   │   ├── src/
│   │   │   ├── routes/         # REST API 路由
│   │   │   │   ├── auth.ts     # Device Code / Token 认证
│   │   │   │   ├── skills.ts   # 技能 CRUD + 搜索
│   │   │   │   ├── namespaces.ts
│   │   │   │   └── sources.ts
│   │   │   ├── services/       # 业务逻辑层
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── skill.service.ts
│   │   │   │   └── storage.service.ts  # S3 制品操作
│   │   │   ├── models/         # Drizzle ORM 数据模型
│   │   │   │   ├── user.ts
│   │   │   │   ├── namespace.ts
│   │   │   │   ├── skill.ts
│   │   │   │   └── schema.ts   # 统一 schema 导出
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts     # JWT / Token 中间件
│   │   │   │   └── rbac.ts     # 角色权限检查
│   │   │   ├── mcp/            # MCP Gateway (mcp-skillhub)
│   │   │   │   └── server.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts        # Hono 应用入口
│   │   ├── drizzle/            # 数据库迁移文件
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/               # Web UI
│   │   ├── src/
│   │   │   └── app/            # Next.js App Router
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                 # 共享类型和工具
│       ├── src/
│       │   ├── types.ts        # 跨包共享类型
│       │   └── constants.ts    # 共享常量
│       ├── package.json
│       └── tsconfig.json
│
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml      # PostgreSQL + MinIO + Backend + Frontend
│
├── docs/
│   ├── ARCHITECTURE.md         # 本文件
│   ├── TASKS.md                # 任务分解
│   └── VERIFICATION.md         # 验证要求
│
├── package.json                # Monorepo 根 (pnpm workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json          # 共享 TS 配置
├── PRD.md
└── .gitignore
```

## 3. 技术栈选型

| 层级 | 技术 | 理由 |
|------|------|------|
| **Monorepo** | pnpm workspaces | 原生 workspace 支持，磁盘高效 |
| **CLI** | Commander.js + TypeScript | 成熟的 CLI 框架，PRD 指定 |
| **Backend** | Hono + TypeScript | 轻量、高性能、类型安全 |
| **ORM** | Drizzle ORM | 类型安全、零开销、PostgreSQL 原生支持 |
| **Frontend** | Next.js 15 (App Router) + Tailwind CSS | PRD 指定 |
| **数据库** | PostgreSQL 16 | PRD 指定，元数据存储 |
| **对象存储** | MinIO (本地) / S3 (生产) | PRD 指定，S3 兼容 |
| **测试** | Vitest | 原生 TypeScript/ESM 支持，速度快 |
| **容器化** | Docker Compose | 本地开发一键启动 |

## 4. 核心模块设计

### 4.1 CLI 配置管理 (`packages/cli/src/lib/config.ts`)

配置文件位于 `~/.skillhub/config.json`：

```json
{
  "sources": [
    {
      "name": "default",
      "url": "https://hub.skillhub.dev",
      "default": true
    },
    {
      "name": "internal",
      "url": "https://skills.company.com"
    }
  ],
  "auth": {
    "https://hub.skillhub.dev": {
      "token": "sk_xxx...",
      "expires_at": "2026-12-31T00:00:00Z",
      "type": "device_code"
    }
  },
  "telemetry": true
}
```

### 4.2 多源管理 (Source Management)

```
skillhub source list           # 列出所有已配置的源
skillhub source add <name> <url>  # 添加新的源
skillhub source remove <name>  # 移除一个源
skillhub source set-default <name> # 设置默认源
```

核心逻辑：
- 配置文件读写：原子写入（先写临时文件再 rename）
- 源 URL 合法性校验
- 防止重复添加同名/同 URL 的源
- `--json` 参数时输出 JSON 格式

### 4.3 认证流程 (Auth Flow)

#### 4.3.1 Device Code 流 (人类开发者)

```
skillhub auth login [--source <name>]
```

流程：
1. CLI 向 Backend `/api/auth/device/code` 请求 Device Code
2. Backend 返回 `{ device_code, user_code, verification_uri, expires_in, interval }`
3. CLI 在终端展示 8 位 `user_code` 和 `verification_uri`
4. CLI 轮询 Backend `/api/auth/device/token`，间隔 `interval` 秒
5. 用户在浏览器完成认证后，CLI 获得 access_token
6. Token 存入 `~/.skillhub/config.json`

#### 4.3.2 Token 流 (机器/Agent)

- 环境变量 `SKILLHUB_TOKEN` 优先于配置文件
- CLI 启动时自动检测环境变量

### 4.4 人机双态输出 (Dual-Mode Output)

```typescript
// output.ts 核心接口
interface OutputAdapter {
  info(message: string): void;
  success(message: string): void;
  error(message: string): void;
  table(data: Record<string, unknown>[]): void;
  json(data: unknown): void;
  progress(label: string, current: number, total: number): void;
}

// 根据 stdout.isTTY 和 --json 标志自动切换
function createOutput(options: { json?: boolean }): OutputAdapter;
```

## 5. 数据模型 (ER)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │  namespaces  │     │    skills    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id (uuid)    │     │ id (uuid)    │     │ id (uuid)    │
│ username     │     │ name (@xxx)  │     │ name         │
│ email        │     │ description  │     │ namespace_id │
│ role (enum)  │     │ visibility   │     │ description  │
│ created_at   │     │ created_at   │     │ latest_tag   │
│ updated_at   │     │ updated_at   │     │ dependencies │
└──────┬───────┘     └──────┬───────┘     │ created_at   │
       │                    │             │ updated_at   │
       │ ┌──────────────────┘             └──────┬───────┘
       │ │                                       │
┌──────┴─┴─────┐                          ┌──────┴───────┐
│ ns_members   │                          │  skill_tags  │
├──────────────┤                          ├──────────────┤
│ user_id      │                          │ id (uuid)    │
│ namespace_id │                          │ skill_id     │
│ role (enum)  │                          │ tag (string) │
│ created_at   │                          │ artifact_key │
└──────────────┘                          │ size_bytes   │
                                          │ checksum     │
                                          │ created_at   │
                                          └──────────────┘
```

## 6. Docker Compose 架构

```yaml
services:
  postgres:     # PostgreSQL 16, 端口 5432
  minio:        # MinIO S3 兼容存储, API 9000, Console 9001
  backend:      # Hono API 服务, 端口 3001
  frontend:     # Next.js 开发服务器, 端口 3000
```

本地开发只需 `docker compose up` 即可启动全部依赖。CLI 直接在宿主机运行，指向本地 backend。

## 7. Phase 1 范围 ✅ (已完成)

**CLI 核心骨架：**
1. Monorepo 初始化 (pnpm workspaces)
2. CLI 入口 + Commander.js 注册
3. 配置管理模块 (config.ts)
4. 多源管理命令 (source list/add/remove/set-default)
5. 认证命令 (auth login/logout/whoami)
6. 人机双态输出模块 (output.ts)
7. Docker Compose (PostgreSQL + MinIO)
8. 单元测试覆盖 (45 tests passing)

## 8. 文档索引

| 文档 | 说明 |
|------|------|
| `docs/ARCHITECTURE.md` | 架构设计 (本文件) |
| `docs/ROADMAP.md` | 全阶段路线图 (Phase 2~4 总览) |
| `docs/TASKS.md` | Phase 1 任务分解 |
| `docs/TASKS-P2.md` | Phase 2 任务分解 (Backend + CLI 全链路) |
| `docs/TASKS-P3.md` | Phase 3 任务分解 (Web UI + MCP Gateway) |
| `docs/TASKS-P4.md` | Phase 4 任务分解 (企业加固 + 生产就绪) |
| `docs/VERIFICATION.md` | 验证要求 |
