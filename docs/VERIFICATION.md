# Skillhub Phase 1 - 验证要求文档

## 1. 测试策略

### 1.1 测试框架
- **单元测试 & 集成测试:** Vitest
- **CLI 集成测试:** execa (子进程调用编译后 CLI)
- **Mock:** Vitest 内置 mock + msw (Mock Service Worker) 用于 HTTP mock

### 1.2 测试目录结构
```
packages/cli/
├── src/
│   └── ...
└── tests/
    ├── unit/
    │   ├── config.test.ts
    │   ├── output.test.ts
    │   ├── source.test.ts
    │   ├── auth.test.ts
    │   └── registry-client.test.ts
    ├── integration/
    │   ├── source-commands.test.ts
    │   └── auth-commands.test.ts
    └── helpers/
        ├── test-config.ts     # 临时配置目录管理
        └── mock-server.ts     # msw mock backend
```

### 1.3 覆盖率要求
- **单元测试覆盖率目标:** ≥ 80% (lines)
- **关键模块 (config, auth-store):** ≥ 90%
- CI 中强制覆盖率门禁

---

## 2. 环境隔离

### 2.1 测试配置隔离
所有测试 **禁止** 读写真实的 `~/.skillhub/` 目录。

```typescript
// tests/helpers/test-config.ts
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export async function createTestConfigDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'skillhub-test-'));
}
```

每个测试用例使用独立的临时目录，通过注入 `configDir` 参数或环境变量 `SKILLHUB_CONFIG_DIR` 覆盖默认路径。

### 2.2 网络隔离
- 单元测试 **禁止** 真实网络请求
- 使用 msw 拦截 HTTP 请求进行 mock
- 集成测试可选择启动 Docker 依赖

---

## 3. 逐模块验证标准

### 3.1 配置管理 (config.ts)

| 场景 | 输入 | 期望输出 |
|------|------|----------|
| 首次运行，无配置文件 | `loadConfig()` | 返回 `{ sources: [默认源], auth: {} }` |
| 配置文件存在 | `loadConfig()` | 返回文件内容解析结果 |
| 配置文件是非法 JSON | `loadConfig()` | 返回默认配置 + stderr 警告 |
| 保存后回读 | `saveConfig(cfg)` → `loadConfig()` | 数据一致 |
| 并发写入 | 两个进程同时 `saveConfig()` | 不产生损坏的文件 |
| 目录不存在 | `saveConfig()` | 自动创建 `~/.skillhub/` |

### 3.2 人机双态输出 (output.ts)

| 场景 | 条件 | 期望行为 |
|------|------|----------|
| 终端模式 | `isTTY=true`, 无 `--json` | 使用 chalk 着色输出 |
| Agent 管道 | `isTTY=false` | 输出纯 JSON |
| 显式 JSON | `--json` flag | 输出纯 JSON |
| JSON 可解析 | 任何 JSON 输出 | `JSON.parse(stdout)` 不抛异常 |
| error 输出 | JSON 模式 error | 包含 `{"error": "..."}` 结构 |

### 3.3 多源管理 (source commands)

| 命令 | 场景 | 期望 |
|------|------|------|
| `source list` | 初始状态 | 显示 1 个默认源 |
| `source add test https://test.com` | 正常 | 成功添加，list 显示 2 个源 |
| `source add test not-a-url` | 无效 URL | 退出码非 0，stderr 报错 |
| `source add default https://x.com` | 重复 name | 退出码非 0，提示已存在 |
| `source remove default` | 唯一源 | 退出码非 0，拒绝删除 |
| `source remove test` | 正常 | 成功移除 |
| `source set-default test` | 存在 | 成功设置 |
| `source set-default ghost` | 不存在 | 退出码非 0 |

### 3.4 认证命令 (auth commands)

| 命令 | 场景 | 期望 |
|------|------|------|
| `auth login` | Backend 可用 | 展示 user_code, 轮询成功后 token 写入 config |
| `auth login` | Backend 不可用 | 友好错误提示 |
| `auth login` | 轮询超时 | 超时错误提示 |
| `auth login` | 已登录 | 提示已登录，询问是否重新登录 |
| `auth logout` | 已登录 | 清除 token，确认成功 |
| `auth logout` | 未登录 | 提示未登录 |
| `auth whoami` | 已登录 | 显示用户名和源 |
| `auth whoami` | `SKILLHUB_TOKEN` 存在 | 优先使用环境变量 |
| `auth whoami` | 未认证 | 提示未登录 |

---

## 4. Docker 验证

### 4.1 Docker Compose 验证清单

```bash
# 1. 启动基础设施
docker compose -f docker/docker-compose.yml up -d

# 2. 验证 PostgreSQL
docker compose -f docker/docker-compose.yml exec postgres \
  psql -U skillhub -d skillhub -c "SELECT 1;"
# 期望: 返回 1

# 3. 验证 MinIO
curl -s http://localhost:9000/minio/health/live
# 期望: HTTP 200

# 4. 验证 MinIO Console
curl -s -o /dev/null -w "%{http_code}" http://localhost:9001
# 期望: 200

# 5. 清理
docker compose -f docker/docker-compose.yml down -v
# 期望: 所有容器和卷被删除
```

### 4.2 数据持久化验证
- `docker compose down` (不带 `-v`) 后重启，数据应保留
- `docker compose down -v` 后重启，数据应全部清除

---

## 5. CI 验证流水线 (建议)

```yaml
# .github/workflows/ci.yml (伪代码)
jobs:
  lint:
    - pnpm lint
  typecheck:
    - pnpm typecheck
  unit-test:
    - pnpm --filter @skillhub/cli test:unit
    - 覆盖率 ≥ 80%
  integration-test:
    - pnpm --filter @skillhub/cli build
    - pnpm --filter @skillhub/cli test:integration
  docker-test:
    - docker compose up -d
    - 运行 Docker 验证清单
    - docker compose down -v
```

---

## 6. 验收定义 (Definition of Done)

一个 Task 被认为"完成"需要满足：

1. **代码编写完成** — 功能代码通过 TypeScript 编译，无类型错误
2. **单元测试通过** — 对应的所有单元测试用例绿色通过
3. **集成测试通过** — 相关集成测试绿色通过（如适用）
4. **Lint 通过** — ESLint 无错误
5. **文档更新** — 代码变更影响的 API 或配置说明已更新
6. **Docker 验证** — Docker 相关变更已通过验证清单
