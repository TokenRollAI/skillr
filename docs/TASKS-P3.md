> **Historical Document** — This was a planning document created during development. For current documentation, see `llmdoc/`.

# Phase 3 任务分解 — Web UI + MCP Gateway

## 总览

Phase 3 让 Skillhub 从"CLI 工具"进化为"完整平台"：Web 浏览技能 + Agent 动态发现。

**前置条件：** Phase 2 全部完成（Backend API 运行、技能可 push/install）

---

## P3-1: 前端基础搭建

**复杂度：** 中

**子任务：**
- [P3-1.1] 初始化 Next.js 15 (App Router) 到 `packages/frontend/`
  - `npx create-next-app@latest --typescript --tailwind --app --src-dir`
- [P3-1.2] 安装 UI 依赖：`@tailwindcss/typography`, `lucide-react` (图标), `zustand`, `sonner` (toast)
- [P3-1.3] 配置暗黑模式主题:
  - 背景: `#0d1117` (GitHub Dark 级别)
  - 主色调: `#58a6ff` (蓝)、`#3fb950` (绿, 成功)、`#f85149` (红, 错误)
  - 字体: JetBrains Mono (代码)、Inter (正文)
- [P3-1.4] 全局布局 (`app/layout.tsx`):
  - 顶部导航: Logo + 搜索框 + 用户菜单
  - 响应式侧边栏: 命名空间列表、快捷导航
- [P3-1.5] API Client (`src/lib/api.ts`):
  - fetch wrapper, 自动附加 JWT
  - 错误处理统一 (toast 通知)
  - 类型安全 (泛型请求)
- [P3-1.6] 全局状态 (`src/stores/`):
  - `auth-store.ts`: 用户会话、token 管理
  - `theme-store.ts`: 主题切换
- [P3-1.7] 共享 UI 组件:
  - `<CopyButton />`: 一键复制到剪贴板
  - `<CliCommand />`: 终端风格命令展示 (带复制)
  - `<Badge />`: 标签/版本徽章
  - `<EmptyState />`: 空状态展示
  - `<Skeleton />`: 加载骨架屏
- [P3-1.8] Docker Compose 加入 frontend 服务
- [P3-1.9] Dockerfile.frontend (standalone 模式)

**验收标准：**
- `pnpm --filter @skillhub/frontend dev` 启动成功
- 暗黑模式正确显示
- API Client 可调用 Backend
- `docker compose up` 包含 frontend

---

## P3-2: 技能浏览与搜索页

**复杂度：** 高

**页面列表：**

| 路由 | 说明 |
|------|------|
| `/` | 首页: 全局搜索 + 热门技能 + 最近更新 |
| `/skills` | 技能列表: 分页、筛选、排序 |
| `/skills/@:ns/:name` | 技能详情: README + 版本 + 安装命令 |
| `/skills/@:ns/:name/versions` | 版本历史 |

**子任务：**
- [P3-2.1] 首页 (`app/page.tsx`):
  - 大搜索框 (Command+K 全局快捷键, `cmdk` 库)
  - 热门技能卡片 (按下载量排序, 前 8 个)
  - 最近更新列表 (最近 10 个 push)
  - "Quick Install" 命令展示
- [P3-2.2] 技能列表页 (`app/skills/page.tsx`):
  - 搜索框 (实时搜索, 200ms debounce)
  - 命名空间筛选下拉
  - 排序: 下载量 / 最近更新 / 名称
  - 卡片视图 / 列表视图切换
  - 分页 (20 个/页)
- [P3-2.3] 技能详情页 (`app/skills/[ns]/[name]/page.tsx`):
  - 顶部: 名称 + 描述 + 命名空间标签
  - 安装命令 (带 CopyButton)
  - README 渲染 (`react-markdown` + `rehype-highlight` + `@tailwindcss/typography`)
  - 右侧边栏: 版本选择、下载量、最后更新、作者
  - Tab: README / Versions / Dependencies (预留)
- [P3-2.4] 版本历史页:
  - 时间线展示每个 tag
  - 每个版本: 发布时间、发布者、大小、checksum
- [P3-2.5] SEO: 每个页面正确的 metadata (title, description, og:image)

**单元测试 (组件测试, Vitest + Testing Library)：**
```
describe('Skills UI')
  ✓ SearchBox - 输入后 debounce 触发搜索
  ✓ SkillCard - 正确渲染名称、描述、下载量
  ✓ CopyButton - 点击后复制到剪贴板
  ✓ CliCommand - 渲染终端风格命令
  ✓ SkillDetail - Markdown 正确渲染
  ✓ VersionList - 按时间排序展示版本
  ✓ Pagination - 正确翻页
```

---

## P3-3: 用户与认证页面

**复杂度：** 中

**页面：**

| 路由 | 说明 |
|------|------|
| `/login` | 登录 |
| `/register` | 注册 |
| `/device` | Device Code 验证 (CLI 引导到此) |
| `/settings` | 用户设置 |
| `/settings/tokens` | Machine Token 管理 |

**子任务：**
- [P3-3.1] 登录页:
  - 用户名 + 密码表单
  - 记住我 (持久化 token)
  - 错误提示
- [P3-3.2] 注册页:
  - 用户名 + 邮箱 + 密码 + 确认密码
  - 密码强度指示器
  - 注册成功后自动登录
- [P3-3.3] Device Code 验证页 (`/device`):
  - 大字体输入框: 输入 8 位 user_code
  - 确认授权按钮
  - 成功后显示 "已授权, 请返回终端"
  - 这是 CLI `auth login` 时引导用户访问的页面
- [P3-3.4] 用户设置页:
  - 个人信息修改 (用户名、邮箱)
  - 密码修改
  - 遥测开关
- [P3-3.5] Machine Token 页:
  - Token 列表 (名称、创建时间、最后使用)
  - 创建新 Token (显示一次, 之后只显示前 8 位)
  - 撤销 Token
- [P3-3.6] 认证状态管理:
  - JWT 存储到 httpOnly cookie (或 localStorage + 刷新机制)
  - 自动刷新过期 token
  - 未认证时重定向到 /login

**单元测试 (5)：**
- 登录表单提交 / 注册表单校验 / Device Code 输入 / Token 创建 / 认证重定向

---

## P3-4: 命名空间管理页

**复杂度：** 中

**页面：**

| 路由 | 说明 |
|------|------|
| `/namespaces` | 命名空间列表 |
| `/namespaces/@:name` | 详情: 技能列表 + 成员 |
| `/namespaces/@:name/settings` | 设置: 可见性、成员管理 |

**子任务：**
- [P3-4.1] 命名空间列表: 卡片展示 (名称、描述、技能数、可见性)
- [P3-4.2] 命名空间详情: 技能列表 + 成员列表
- [P3-4.3] 成员管理: 邀请 (搜索用户名)、角色变更下拉、移除确认
- [P3-4.4] 创建/编辑命名空间表单 (名称、描述、可见性)
- [P3-4.5] 权限控制: 非 maintainer 看不到 settings tab

**单元测试 (4)：**
- 列表渲染 / 成员角色变更 / 创建表单 / 权限隐藏

---

## P3-5: 管理后台

**复杂度：** 中

**页面 (仅 Global Admin 可见)：**

| 路由 | 说明 |
|------|------|
| `/admin` | 仪表盘: 用户数、技能数、下载总量 |
| `/admin/users` | 用户管理: 列表、角色修改、禁用 |
| `/admin/namespaces` | 命名空间管理: 全局视图 |
| `/admin/skills` | 技能管理: 全局搜索、删除 |

**子任务：**
- [P3-5.1] Admin 路由守卫 (非 admin 返回 403)
- [P3-5.2] 仪表盘统计卡片
- [P3-5.3] 用户管理表格 (搜索、分页、角色编辑)
- [P3-5.4] 技能管理表格 (搜索、删除确认)

---

## P3-6: MCP Gateway (mcp-skillhub)

**复杂度：** 高

**新增包：** `packages/mcp/` 或集成在 backend 中

**MCP 工具：**

| 工具 | 参数 | 返回 |
|------|------|------|
| `search_skills` | `query, namespace?, limit?` | 技能列表 (名称、描述、安装命令) |
| `get_skill_info` | `namespace, name, tag?` | 技能详情 (README 全文、版本、依赖) |
| `list_namespaces` | — | 命名空间列表 |
| `get_install_instructions` | `namespace, name` | 安装命令 + SKILL.md 摘要 |

**子任务：**
- [P3-6.1] 安装 `@modelcontextprotocol/sdk`
- [P3-6.2] MCP Server 骨架 (stdio transport)
- [P3-6.3] `search_skills` 实现
- [P3-6.4] `get_skill_info` 实现
- [P3-6.5] `list_namespaces` 实现
- [P3-6.6] `get_install_instructions` 实现
- [P3-6.7] 独立可执行包: `npx mcp-skillhub --backend-url <url> --token <token>`
- [P3-6.8] 配置文档:
  ```json
  // Claude Code: ~/.claude/settings.json
  {
    "mcpServers": {
      "skillhub": {
        "command": "npx",
        "args": ["mcp-skillhub"],
        "env": {
          "SKILLHUB_BACKEND_URL": "https://hub.skillhub.dev",
          "SKILLHUB_TOKEN": "sk_xxx"
        }
      }
    }
  }
  ```

**验收标准：**
- Claude Code 中 `search_skills` 返回正确结果
- Agent 可根据返回信息自主安装技能
- MCP 工具描述清晰，Agent 无幻觉

**单元测试 (6)：**
- search 正常 / search 空结果 / get_skill_info 正常 / 不存在 / list_namespaces / install_instructions

---

## P3-7: CLI search 命令

**复杂度：** 低

**子任务：**
- [P3-7.1] 实现 `skillhub search <query> [--namespace @ns] [--limit N]`
- [P3-7.2] 表格输出: 名称、描述、版本、下载量
- [P3-7.3] `--json` 输出

**单元测试 (3)：**
- 搜索有结果 / 搜索无结果 / --json 输出

---

## 依赖关系

```
第 1 波 (并行):
  P3-1 (前端基础)
  P3-6 (MCP Gateway)
  P3-7 (CLI search)

第 2 波 (依赖 P3-1, 可并行):
  P3-2 (技能浏览)
  P3-3 (用户认证)

第 3 波 (依赖 P3-2 + P3-3):
  P3-4 (命名空间)
  P3-5 (管理后台)
```
