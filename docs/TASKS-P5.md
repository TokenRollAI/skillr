> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Phase 5: 管理界面完善 + API Key 系统

## 总览

Phase 5 的目标是**消灭所有后端 API 与前端 UI 的断裂点**，并新增完整的 **API Key 生命周期管理**。

**前置条件：** Phase 1-4 全部完成，后端 17 个 API 端点已就绪，前端 7 个页面已就绪。

---

## 现状审计

### 后端 API → 前端 UI 映射表

| # | 后端端点 | 方法 | 前端 UI | 状态 |
|---|---------|------|---------|------|
| 1 | `/health` | GET | — | ✅ 无需 UI |
| 2 | `/api/auth/register` | POST | `/register` | ✅ 已有 |
| 3 | `/api/auth/login` | POST | `/login` | ✅ 已有 |
| 4 | `/api/auth/device/code` | POST | CLI 调用 | ✅ 无需 UI |
| 5 | `/api/auth/device/approve` | POST | `/device` | ✅ 已有 |
| 6 | `/api/auth/device/token` | POST | CLI 轮询 | ✅ 无需 UI |
| 7 | `/api/auth/me` | GET | NavBar 用户信息 | ⚠️ 未调用 |
| 8 | `/api/namespaces` | POST | — | ❌ **缺创建表单** |
| 9 | `/api/namespaces` | GET | `/namespaces` | ✅ 已有 |
| 10 | `/api/namespaces/:name` | GET | — | ❌ **缺详情页** |
| 11 | `/api/namespaces/:name/members` | POST | — | ❌ **缺成员管理** |
| 12 | `/api/namespaces/:name/members` | GET | — | ❌ **缺成员列表** |
| 13 | `/api/namespaces/:name/members/:userId` | DELETE | — | ❌ **缺移除成员** |
| 14 | `/api/skills` | GET | `/skills` | ✅ 已有 |
| 15 | `/api/skills/:ns/:name` | POST | CLI push | ✅ 无需 UI |
| 16 | `/api/skills/:ns/:name` | GET | `/skills/[ns]/[name]` | ✅ 已有 |
| 17 | `/api/skills/:ns/:name/tags` | GET | Skill 详情侧边栏 | ✅ 已有 |
| 18 | `/api/skills/:ns/:name/tags/:tag` | GET | — | ⚠️ 仅 CLI 用 |
| 19 | `/api/skills/:ns/:name` | DELETE | — | ❌ **缺删除按钮** |
| 20 | `/api/auth/apikeys` | — | — | ❌ **完全不存在** |

### 需要新增的功能

**前端补全 (6 个)：**
1. Namespace 创建表单
2. Namespace 详情页 (技能列表 + 成员列表)
3. Namespace 成员管理 (添加/移除/角色)
4. Skill 删除功能 (确认对话框)
5. 用户个人设置页
6. Admin Dashboard

**API Key 系统 (全新, 后端+前端)：**
7. API Key 数据模型
8. API Key CRUD API
9. API Key 前端管理页
10. 后端认证中间件支持 API Key

---

## Task P5-1: API Key 数据模型与后端

**复杂度：** 高

### 新增数据库表

```sql
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(128) NOT NULL,           -- 用户给 key 起的名字, 如 "CI/CD", "Claude Agent"
  prefix      VARCHAR(12) NOT NULL,            -- key 前缀, 如 "sk_a3f8", 用于列表展示
  key_hash    VARCHAR(255) NOT NULL,           -- sha256(full_key), 不存明文
  scopes      JSONB DEFAULT '["read"]',        -- 权限范围: read, write, admin
  last_used_at TIMESTAMPTZ,                    -- 最后使用时间
  expires_at  TIMESTAMPTZ,                     -- 过期时间 (null = 永不过期)
  revoked     BOOLEAN DEFAULT false,           -- 是否已吊销
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
```

### API Key 格式

```
sk_live_<32字节随机hex>
```

示例: `sk_live_a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5`

- 前缀 `sk_live_` 便于识别
- 完整 key 只在创建时返回一次，之后只存 hash
- 列表展示时只显示 `sk_live_a3f8...` (前 4 位)

### 后端 API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| `POST` | `/api/auth/apikeys` | 创建 API Key | requireAuth |
| `GET` | `/api/auth/apikeys` | 列出当前用户的 API Keys | requireAuth |
| `GET` | `/api/auth/apikeys/:id` | 获取单个 Key 详情 | requireAuth |
| `DELETE` | `/api/auth/apikeys/:id` | 吊销 (revoke) Key | requireAuth |
| `POST` | `/api/auth/apikeys/:id/rotate` | 轮换 Key (吊销旧的, 生成新的, 继承名称和权限) | requireAuth |

### 子任务

- [P5-1.1] 创建 `packages/backend/src/models/api-key.ts` Drizzle schema
- [P5-1.2] 更新 `schema.ts` 导出 + `drizzle-schema.ts`
- [P5-1.3] 运行 `drizzle-kit push` 创建表
- [P5-1.4] 创建 `packages/backend/src/services/apikey.service.ts`:
  - `createApiKey(userId, name, scopes?, expiresAt?)` → 返回完整 key (仅此一次)
  - `listApiKeys(userId)` → 返回 key 列表 (不含明文, 只有 prefix)
  - `getApiKey(id, userId)` → 返回单个 key 详情
  - `revokeApiKey(id, userId)` → 标记 revoked=true
  - `rotateApiKey(id, userId)` → 吊销旧 key + 创建新 key (继承 name/scopes)
  - `validateApiKey(fullKey)` → 校验 key, 更新 last_used_at, 返回用户信息
- [P5-1.5] 创建 `packages/backend/src/routes/apikeys.ts`:
  - 实现 5 个 CRUD 端点
  - 创建时返回: `{ id, name, key: "sk_live_...", prefix, scopes, createdAt }`
  - 列出时返回: `{ id, name, prefix, scopes, lastUsedAt, expiresAt, revoked, createdAt }`
- [P5-1.6] 更新 `packages/backend/src/middleware/auth.ts`:
  - 支持 `Authorization: Bearer sk_live_...` API Key 认证
  - 检测 token 前缀: 以 `sk_live_` 开头 → 走 API Key 校验; 否则 → 走 JWT 校验
  - API Key 校验: sha256 后查库, 检查 revoked/expired, 更新 last_used_at
- [P5-1.7] 在 `packages/backend/src/index.ts` 注册 apikeys 路由
- [P5-1.8] 审计日志: `apikey.create`, `apikey.revoke`, `apikey.rotate`

### 验收标准

- 创建 key 后, 完整 key 只返回一次
- 用 API Key 可以调用受保护端点 (替代 JWT)
- 吊销后的 key 返回 401
- 过期的 key 返回 401
- rotate 后旧 key 失效, 新 key 可用
- `SKILLHUB_TOKEN=sk_live_xxx skillhub auth whoami` 可以工作

### 单元测试 (12)

```
describe('API Key Service')
  ✓ 创建 key 返回完整 key
  ✓ 创建 key 后 hash 存储正确
  ✓ 列出 key 不包含明文
  ✓ 校验合法 key 成功
  ✓ 校验后 last_used_at 更新
  ✓ 吊销 key 后校验失败
  ✓ 过期 key 校验失败
  ✓ rotate 返回新 key
  ✓ rotate 后旧 key 失效
  ✓ rotate 后新 key 可用
  ✓ 其他用户无法操作别人的 key
  ✓ auth 中间件支持 sk_live_ 前缀
```

---

## Task P5-2: Namespace 管理页面

**复杂度：** 中

### 新增/修改页面

| 路由 | 类型 | 说明 |
|------|------|------|
| `/namespaces` | 修改 | 添加 "Create Namespace" 按钮 |
| `/namespaces/create` | 新增 | 创建 Namespace 表单 |
| `/namespaces/[name]` | 新增 | Namespace 详情 (技能列表 + 成员) |
| `/namespaces/[name]/settings` | 新增 | 设置页 (成员管理) |

### 子任务

- [P5-2.1] 修改 `/namespaces` 页面: 添加创建按钮 (已登录时显示)
- [P5-2.2] 创建 `/namespaces/create` 页面:
  - 表单: 名称 (@前缀自动添加)、描述、可见性 (public/internal/private)
  - 提交后跳转到详情页
- [P5-2.3] 创建 `/namespaces/[name]` 详情页:
  - 基本信息 (名称、描述、可见性)
  - 该 Namespace 下的技能列表 (调用 `GET /api/skills?namespace=@name`)
  - 成员列表 (调用 `GET /api/namespaces/@name/members`)
  - 操作按钮: Settings (仅 maintainer 可见)
- [P5-2.4] 创建 `/namespaces/[name]/settings` 页面:
  - 成员管理:
    - 当前成员列表 (用户名、角色、加入时间)
    - 添加成员表单 (输入用户 ID + 选择角色)
    - 移除成员按钮 (带确认对话框)
  - 仅 maintainer/admin 可访问

### 单元测试 (组件)

```
describe('Namespace Pages')
  ✓ 创建表单提交正确数据
  ✓ 详情页显示技能列表
  ✓ 详情页显示成员列表
  ✓ 非 maintainer 看不到 Settings 按钮
  ✓ 添加成员成功
  ✓ 移除成员带确认对话框
```

---

## Task P5-3: Skill 管理增强

**复杂度：** 中

### 子任务

- [P5-3.1] Skill 详情页添加删除按钮:
  - 仅 maintainer/admin 可见
  - 点击弹出确认对话框: "确定要删除 @ns/skill-name 吗? 此操作不可撤销。"
  - 确认后调用 `DELETE /api/skills/:ns/:name`
  - 删除成功后跳转回 Skills 列表
- [P5-3.2] 创建确认对话框组件 `components/confirm-dialog.tsx`
- [P5-3.3] Skill 详情页增强:
  - 显示 checksum 和文件大小
  - 下载按钮 (调用 tag 端点获取签名 URL)
  - 显示发布者信息

### 验收标准

- maintainer 可以在 UI 上删除自己 Namespace 下的 Skill
- viewer 看不到删除按钮
- 删除需二次确认

---

## Task P5-4: API Key 前端管理页

**复杂度：** 高

### 新增页面

| 路由 | 说明 |
|------|------|
| `/settings` | 用户设置主页 (个人信息) |
| `/settings/keys` | API Key 管理页 |

### 子任务

- [P5-4.1] 创建 `/settings` 页面:
  - 用户信息展示 (调用 `GET /api/auth/me`)
  - 侧边栏导航: Profile / API Keys
  - 密码修改表单 (需后端增加 `PUT /api/auth/password`)
- [P5-4.2] 创建 `/settings/keys` 页面:
  - "Create New Key" 按钮 → 弹出创建表单:
    - 名称 (如 "CI Pipeline", "Claude Agent")
    - 权限范围 (read / write / admin) 多选
    - 过期时间 (30天 / 90天 / 1年 / 永不过期)
  - 创建成功后**一次性展示完整 key** (带复制按钮 + 警告"此 key 不会再次显示")
  - Key 列表表格:
    - 名称
    - 前缀 (`sk_live_a3f8...`)
    - 权限范围 (badges)
    - 最后使用时间
    - 创建时间
    - 过期时间
    - 状态 (Active / Revoked / Expired)
    - 操作: Revoke / Rotate
  - Revoke 带确认对话框
  - Rotate 带确认 + 一次性展示新 key
- [P5-4.3] 导航栏用户名添加下拉菜单: Settings / Logout
- [P5-4.4] 后端增加密码修改端点 `PUT /api/auth/password`

### 验收标准

- 创建 Key 后可立即在 CLI 中使用: `SKILLHUB_TOKEN=sk_live_xxx skillhub auth whoami`
- Key 创建后完整值仅展示一次
- Revoke 后 Key 立即失效
- Rotate 后旧 Key 失效, 新 Key 可用
- 过期 Key 自动标记为 Expired

### 单元测试

```
describe('API Key UI')
  ✓ 创建表单提交正确数据
  ✓ 新 key 显示在弹窗中并可复制
  ✓ key 列表正确渲染
  ✓ revoke 需确认
  ✓ rotate 返回新 key
  ✓ expired key 显示正确状态
```

---

## Task P5-5: Admin Dashboard

**复杂度：** 中

### 新增页面

| 路由 | 说明 |
|------|------|
| `/admin` | 管理面板首页 (统计卡片) |
| `/admin/users` | 用户管理 |
| `/admin/audit` | 审计日志 |

### 子任务

- [P5-5.1] 后端增加 Admin API:
  - `GET /api/admin/stats` → `{ userCount, namespaceCount, skillCount, totalDownloads }`
  - `GET /api/admin/users?page=1&limit=20` → 用户列表
  - `PUT /api/admin/users/:id/role` → 修改用户角色
  - `GET /api/admin/audit?action=&from=&to=&page=1` → 审计日志查询
- [P5-5.2] 创建 `/admin` 页面:
  - 统计卡片: 用户数、命名空间数、技能数、总下载量
  - 最近活动列表 (最近 10 条审计日志)
  - 仅 admin 可访问 (非 admin 返回 403 页面)
- [P5-5.3] 创建 `/admin/users` 页面:
  - 用户列表表格 (用户名、邮箱、角色、注册时间)
  - 角色修改下拉 (viewer / admin)
  - 搜索/分页
- [P5-5.4] 创建 `/admin/audit` 页面:
  - 审计日志列表 (时间、用户、操作、资源)
  - 筛选: 按操作类型、按时间范围
  - 分页

---

## Task P5-6: CLI 支持 API Key

**复杂度：** 低

### 子任务

- [P5-6.1] CLI `auth` 新增子命令:
  - `skillhub auth create-key --name "CI Pipeline" --scope read,write`
  - `skillhub auth list-keys`
  - `skillhub auth revoke-key <key-id>`
- [P5-6.2] RegistryClient 新增 API Key 管理方法
- [P5-6.3] 文档更新: README + CLI 使用指南

### 验收标准

- 可以通过 CLI 创建和管理 API Key
- `SKILLHUB_TOKEN=sk_live_xxx` 可用于所有 CLI 命令

---

## 依赖关系与执行顺序

```
第 1 波 (并行):
  P5-1 (API Key 后端)     — 最高优先级, 后续都依赖
  P5-2 (Namespace 页面)   — 独立, 仅依赖现有后端
  P5-3 (Skill 管理增强)   — 独立

第 2 波 (依赖 P5-1):
  P5-4 (API Key 前端)     — 依赖 P5-1
  P5-5 (Admin Dashboard)  — 需后端新增 Admin API
  P5-6 (CLI API Key)      — 依赖 P5-1
```

---

## 测试统计

| Task | 单元测试 | 备注 |
|------|---------|------|
| P5-1 | 12 | API Key 服务 + 中间件 |
| P5-2 | 6 | Namespace 页面组件 |
| P5-3 | 3 | 删除确认 + 权限 |
| P5-4 | 6 | API Key UI 组件 |
| P5-5 | 4 | Admin 页面 + 权限守卫 |
| P5-6 | 3 | CLI API Key 命令 |
| **总计** | **34** | |

---

## 完成后的完整 UI 页面列表

```
/                           首页 (搜索 + 功能介绍)
/login                      登录
/register                   注册
/device                     Device Code 验证
/skills                     技能列表 (搜索 + 筛选)
/skills/[ns]/[name]         技能详情 (README + 版本 + 删除)
/namespaces                 命名空间列表 + 创建
/namespaces/create          创建命名空间
/namespaces/[name]          命名空间详情 (技能 + 成员)
/namespaces/[name]/settings 命名空间设置 (成员管理)
/settings                   用户设置 (个人信息)
/settings/keys              API Key 管理
/admin                      管理面板 (统计)
/admin/users                用户管理
/admin/audit                审计日志
```

**共 15 个页面, 覆盖所有后端 API + API Key 全生命周期。**
