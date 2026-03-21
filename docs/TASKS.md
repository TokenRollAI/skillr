> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Skillhub Phase 1 - 任务分解

## 总览

Phase 1 聚焦 CLI 核心骨架，包含 Monorepo 初始化、多源管理和认证登录功能。

---

## Task 1: Monorepo 基础设施初始化

**目标：** 搭建 pnpm workspaces monorepo 骨架，确保所有子包可以正确引用。

**子任务：**
- [T1.1] 初始化根 `package.json`，配置 pnpm workspaces
- [T1.2] 创建 `pnpm-workspace.yaml`
- [T1.3] 创建 `tsconfig.base.json` 共享 TypeScript 配置
- [T1.4] 创建 `packages/shared` 子包（共享类型和常量）
- [T1.5] 创建 `packages/cli` 子包骨架
- [T1.6] 创建 `packages/backend` 子包骨架（空壳，仅 package.json）
- [T1.7] 创建 `packages/frontend` 子包骨架（空壳，仅 package.json）
- [T1.8] 创建 `.gitignore`

**验收标准：**
- `pnpm install` 成功执行
- `packages/cli` 可以 import `@skillhub/shared` 的类型
- TypeScript 编译零错误

---

## Task 2: Docker Compose 本地开发环境

**目标：** 一键启动 PostgreSQL + MinIO 本地开发依赖。

**子任务：**
- [T2.1] 编写 `docker/docker-compose.yml`（PostgreSQL 16 + MinIO）
- [T2.2] 配置 PostgreSQL 初始化（创建 skillhub 数据库）
- [T2.3] 配置 MinIO 初始化（创建 skillhub-artifacts 桶）
- [T2.4] 添加 `.env.example` 配置环境变量模板
- [T2.5] 在根 `package.json` 添加 `dev:infra` 脚本

**验收标准：**
- `docker compose -f docker/docker-compose.yml up -d` 成功启动
- PostgreSQL 可连接 (`psql` 或 pg 客户端验证)
- MinIO Console 可访问 (`http://localhost:9001`)
- `docker compose down -v` 可以干净地清理所有数据

---

## Task 3: CLI 入口与命令注册

**目标：** 搭建 Commander.js 命令框架，注册所有子命令。

**子任务：**
- [T3.1] 安装依赖：`commander`, `chalk`, `ora`, `cli-table3`
- [T3.2] 编写 CLI 入口 `src/index.ts`，注册顶层命令组 (auth, source)
- [T3.3] 配置 `package.json` 的 `bin` 字段，指向编译产物
- [T3.4] 配置 `tsup` 或 `esbuild` 进行 CLI 打包
- [T3.5] 验证 `npx skillhub --help` 输出正确的命令列表

**验收标准：**
- `pnpm --filter @skillhub/cli build` 编译成功
- `skillhub --help` 显示 version 和命令列表
- `skillhub auth --help` 显示 auth 子命令
- `skillhub source --help` 显示 source 子命令

**单元测试：**
- 测试 CLI 入口加载无异常
- 测试 `--version` 输出正确版本号

---

## Task 4: 配置管理模块

**目标：** 实现 `~/.skillhub/config.json` 的读写管理。

**子任务：**
- [T4.1] 定义配置文件 TypeScript 类型 (`SkillhubConfig`, `SourceConfig`, `AuthEntry`)
- [T4.2] 实现 `loadConfig()` — 读取配置文件，不存在时返回默认配置
- [T4.3] 实现 `saveConfig()` — 原子写入（写临时文件 + rename）
- [T4.4] 实现 `getConfigDir()` — 返回 `~/.skillhub/` 路径，自动创建目录
- [T4.5] 实现 `getDefaultSource()` — 返回默认源配置
- [T4.6] 实现 `getAuthToken(sourceUrl)` — 优先检查 `SKILLHUB_TOKEN` 环境变量

**验收标准：**
- 配置文件不存在时，`loadConfig()` 返回合理默认值
- `saveConfig()` 后 `loadConfig()` 读回相同数据
- 原子写入：写入中途进程退出不会损坏配置文件
- 环境变量 `SKILLHUB_TOKEN` 优先级高于配置文件

**单元测试 (Vitest)：**
```
describe('config')
  ✓ loadConfig - 配置文件不存在时返回默认配置
  ✓ loadConfig - 正确读取已有配置
  ✓ loadConfig - 配置文件损坏时返回默认配置并发出警告
  ✓ saveConfig - 正确写入并可回读
  ✓ saveConfig - 自动创建 ~/.skillhub/ 目录
  ✓ getConfigDir - 返回正确的路径
  ✓ getDefaultSource - 有默认源时返回正确结果
  ✓ getDefaultSource - 无源时返回 undefined
  ✓ getAuthToken - 环境变量优先于配置文件
  ✓ getAuthToken - 环境变量不存在时从配置文件读取
```

---

## Task 5: 人机双态输出模块

**目标：** 实现 TTY 高亮 / JSON 纯净输出的自动切换。

**子任务：**
- [T5.1] 定义 `OutputAdapter` 接口
- [T5.2] 实现 `TtyOutput` — 使用 chalk + ora + cli-table3 的彩色输出
- [T5.3] 实现 `JsonOutput` — 输出严格 JSON 到 stdout
- [T5.4] 实现 `createOutput(options)` 工厂函数 — 根据 `isTTY` 和 `--json` 自动选择

**验收标准：**
- TTY 模式下输出带颜色
- `--json` 模式下输出可被 `JSON.parse()` 解析
- Agent 管道模式下 (`!isTTY`) 自动使用 JSON 输出

**单元测试：**
```
describe('output')
  ✓ createOutput - isTTY=true 且无 --json 时返回 TtyOutput
  ✓ createOutput - isTTY=false 时返回 JsonOutput
  ✓ createOutput - --json=true 时返回 JsonOutput
  ✓ JsonOutput.info - 输出合法 JSON
  ✓ JsonOutput.table - 输出 JSON 数组
  ✓ JsonOutput.error - 输出包含 error 字段的 JSON
  ✓ TtyOutput.info - 调用 chalk 输出
  ✓ TtyOutput.table - 输出格式化表格
```

---

## Task 6: 多源管理命令

**目标：** 实现 `skillhub source list/add/remove/set-default` 四个子命令。

**子任务：**
- [T6.1] 实现 `source list` — 列出已配置源，标记默认源
- [T6.2] 实现 `source add <name> <url>` — 添加源，校验 URL，检查重复
- [T6.3] 实现 `source remove <name>` — 删除源，防止删除最后一个源
- [T6.4] 实现 `source set-default <name>` — 设置默认源
- [T6.5] 所有命令支持 `--json` 输出

**验收标准：**
- `source list` 正确展示所有源并标记默认
- `source add` 校验 URL 格式，拒绝无效 URL
- `source add` 拒绝重复 name 或 URL
- `source remove` 拒绝删除唯一源
- `source set-default` 对不存在的 name 报错
- `--json` 输出均可被 JSON.parse 解析

**单元测试：**
```
describe('source commands')
  ✓ source list - 列出默认初始源
  ✓ source list --json - 输出 JSON 数组
  ✓ source add - 成功添加新源
  ✓ source add - 拒绝无效 URL
  ✓ source add - 拒绝重复 name
  ✓ source add - 拒绝重复 URL
  ✓ source remove - 成功移除源
  ✓ source remove - 拒绝移除最后一个源
  ✓ source remove - 不存在的 name 报错
  ✓ source set-default - 成功设置默认源
  ✓ source set-default - 不存在的 name 报错
```

---

## Task 7: 认证命令 (auth login/logout/whoami)

**目标：** 实现 Device Code 认证流和 Token 管理。

**子任务：**
- [T7.1] 实现 `RegistryClient` — 封装 HTTP 请求到 Backend API
- [T7.2] 实现 `auth login` — Device Code 流
  - 请求 device code
  - 展示 user_code 和 verification_uri
  - 轮询 token 端点
  - 成功后存储 token
- [T7.3] 实现 `auth logout` — 清除指定源的 token
- [T7.4] 实现 `auth whoami` — 显示当前认证用户信息
- [T7.5] 实现 `auth status` — 显示所有源的认证状态
- [T7.6] 支持 `--source <name>` 指定源
- [T7.7] 支持 `SKILLHUB_TOKEN` 环境变量自动认证

**验收标准：**
- `auth login` 在 TTY 下展示 user_code 和引导链接
- `auth login` 轮询直到认证成功或超时
- `auth logout` 清除 token 后 `auth whoami` 报未认证
- `SKILLHUB_TOKEN` 存在时，`auth whoami` 直接使用环境变量
- 网络错误时有友好提示

**单元测试：**
```
describe('auth commands')
  ✓ auth login - 发起 device code 请求
  ✓ auth login - 展示正确的 user_code
  ✓ auth login - 轮询成功后存储 token
  ✓ auth login - 轮询超时后报错
  ✓ auth login - 网络错误时友好提示
  ✓ auth login --source - 指定特定源认证
  ✓ auth logout - 清除 token
  ✓ auth logout - 未登录时提示
  ✓ auth whoami - 展示当前用户信息
  ✓ auth whoami - 未认证时提示登录
  ✓ auth whoami - 优先使用 SKILLHUB_TOKEN
  ✓ auth status - 列出所有源的认证状态
  ✓ RegistryClient - 正确发送带 token 的请求
  ✓ RegistryClient - 401 时提示重新登录
```

---

## Task 8: 集成测试

**目标：** 端到端验证 CLI 核心流程。

**子任务：**
- [T8.1] 搭建集成测试框架（使用 `execa` 调用编译后 CLI）
- [T8.2] 编写 source 命令集成测试（使用临时 config 目录）
- [T8.3] 编写 auth 命令集成测试（mock backend API）

**验收标准：**
- 集成测试使用隔离的临时目录，不影响真实 `~/.skillhub/`
- 所有集成测试可在 CI 中无 Docker 依赖运行

---

## 任务依赖关系

```
T1 (Monorepo 初始化)
 ├── T2 (Docker Compose)         [并行]
 ├── T3 (CLI 入口)               [依赖 T1]
 │    ├── T4 (配置管理)          [依赖 T3]
 │    ├── T5 (输出模块)          [依赖 T3]
 │    ├── T6 (多源管理)          [依赖 T4, T5]
 │    └── T7 (认证命令)          [依赖 T4, T5]
 └── T8 (集成测试)               [依赖 T6, T7]
```

## 估算

| Task | 复杂度 |
|------|--------|
| T1 Monorepo 初始化 | 低 |
| T2 Docker Compose | 低 |
| T3 CLI 入口 | 低 |
| T4 配置管理 | 中 |
| T5 输出模块 | 中 |
| T6 多源管理 | 中 |
| T7 认证命令 | 高 |
| T8 集成测试 | 中 |
