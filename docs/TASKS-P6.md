> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Phase 6: Cloudflare Workers 双运行时适配

## 目标

让同一份 Hono 代码既能在 Node.js (Docker) 上运行，也能部署到 CF Workers。通过运行时适配层（Runtime Adapter Pattern）隔离平台差异。

## 适配清单

| 模块 | Node.js | CF Workers | 适配策略 |
|------|---------|------------|----------|
| HTTP Server | `@hono/node-server` | `export default app` | 两个入口文件 |
| 密码哈希 | argon2 (native) | Web Crypto PBKDF2 | 统一接口 `PasswordHasher` |
| 数据库 | postgres.js (TCP) | Hyperdrive 或 D1 | 统一接口 `DbAdapter` |
| 对象存储 | @aws-sdk/client-s3 | R2 Bindings | 统一接口 `StorageAdapter` |
| 文件系统 | fs (bootstrap.ts) | 不需要 (D1 migration) | 条件加载 |
| crypto | Node.js crypto | Web Crypto API | 用 Web Crypto 统一 (两端都支持) |
| 环境变量 | process.env | Env bindings | Hono `c.env` 统一 |

## 架构设计

```
packages/backend/src/
├── index.ts              # Hono app 定义 (平台无关)
├── index.node.ts         # Node.js 入口 (serve + bootstrap)
├── index.worker.ts       # CF Workers 入口 (export default)
├── runtime/
│   ├── types.ts          # Runtime adapter 接口定义
│   ├── node.ts           # Node.js 实现
│   └── worker.ts         # CF Workers 实现
├── routes/               # 路由 (平台无关)
├── services/             # 业务逻辑 (使用 adapter 接口)
└── ...
```

## Tasks

### P6-1: Runtime Adapter 接口

创建 `packages/backend/src/runtime/types.ts`:
```typescript
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface DbClient {
  // Drizzle-compatible query builder
  // 或者直接暴露 drizzle instance
}

export interface StorageClient {
  upload(key: string, body: ArrayBuffer, contentType?: string): Promise<void>;
  download(key: string): Promise<ArrayBuffer | null>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface RuntimeContext {
  db: DbClient;
  storage: StorageClient;
  password: PasswordHasher;
  env: Record<string, string>;
}
```

### P6-2: 替换 crypto 为 Web Crypto

Node.js 18+ 和 CF Workers 都支持 Web Crypto API (`crypto.subtle`)。
替换 `randomBytes` → `crypto.getRandomValues`，`createHash('sha256')` → `crypto.subtle.digest('SHA-256')`。

### P6-3: 替换 argon2 为可切换的 PasswordHasher

Node.js: 继续用 argon2
Workers: 用 Web Crypto PBKDF2 或 bcryptjs (pure JS)

### P6-4: 替换 postgres.js 为可切换的 DB

Node.js: postgres.js + drizzle
Workers: Hyperdrive + drizzle (Hyperdrive 代理 PG 连接) 或 D1

### P6-5: 替换 @aws-sdk 为可切换的 Storage

Node.js: @aws-sdk/client-s3 (MinIO)
Workers: R2 bindings (直接绑定，零配置)

### P6-6: Workers 入口 + wrangler 配置

### P6-7: 测试两个运行时都能工作
