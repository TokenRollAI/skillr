# Skillhub: 企业级 AI Agent 技能聚合与分发中心 (PRD & 架构设计)

## 1. 产品愿景 (Vision)

构建 AI Agent 时代的 "DockerHub + NPM"，遵循 **Open Agent Skills Standard**。为 Claude Code, Codex, OpenClaw 等 AI 编程助手提供统一的技能（Skill）发现、聚合、分发与复用平台。

核心理念：**极客友好、Agent 自治、安全优先、多源联邦。**

## 2. 系统架构 (System Architecture)

### 2.1 基础设施层

- **存储层 (Storage):**
  - **元数据 (Metadata):** PostgreSQL (存储 Namespace, 团队, 用户, 技能索引, 版本 Tag)。
  - **制品存储 (Artifacts):** 标准 S3 兼容对象存储 (AWS S3 / MinIO)，存储打包后的 Skill 压缩包 (`.tar.gz`)。
- **服务端 (Backend API & Hub):**
  - 提供 REST/GraphQL API 供 CLI 和 Web UI 调用。
  - **MCP Gateway (`mcp-skillhub`):** 原生提供的 MCP Server，允许 Agent 通过 MCP 协议直接查询全局能力地图。

### 2.2 客户端体验层

- **Web UI (前端大盘):**
  - **技术栈:** Next.js (App Router) + Tailwind CSS。
  - **设计语言:** 极客风 (Geek Chic)、暗黑模式为主、高对比度、等宽字体 (Monospace) 排版。强调搜索和 CLI 命令的一键复制。
- **核心驱动 (CLI - `skillhub`):**
  - 多源支持 (Multi-registry)，类似 Homebrew。
  - **人机双态输出:** 检测标准输出 (`stdout.isTTY`)。若是开发者，输出高亮进度条；若是 Agent (或带 `--json` 参数)，输出严格的 JSON 或 Markdown 表格，确保 Agent 解析零幻觉。

## 3. 核心领域模型 (Domain Model)

- **Registry (源):** 技能仓库的地址，支持配置多个（如内部私有源、社区公共源）。
- **Namespace (命名空间):** 基于组织架构或业务线的隔离域（如 `@frontend`, `@data-infra`），是权限控制 (RBAC) 的核心。
- **Skill (技能):**
  - 物理形态：一个包含 `SKILL.md` 的目录打包成的 `.tar.gz`。
  - 逻辑形态：包含了指令 (Instructions)、可选脚本 (Scripts) 和元数据的能力单元。
- **Tag (标签):** 类似 Docker 的版本管理（如 `latest`, `v1.0.0`），默认拉取 `latest`。

## 4. 核心工作流与 CLI 规约 (Core Workflows)

### 4.1 认证与安全 (Authentication & Security)

- **人类开发者 (Device Code 流):**
  - 执行 `skillhub auth login`。
  - CLI 在无浏览器环境下输出 8 位验证码，提示用户前往 `https://hub.company.com/device` 认证 (支持 OAuth / SSO)。
- **机器/Agent (Token 流):**
  - 支持发放长效 Machine Token，通过环境变量 `SKILLHUB_TOKEN` 注入，供 CI/CD 或 Agent 静默调用。

### 4.2 多源管理 (Registry Management)

类似 Homebrew 的设计，方便接入外部生态。

- `skillhub source list`：查看当前配置的源。
- `skillhub source add <name> <url>`：添加新的技能注册中心。

### 4.3 智能扫描与发布 (Scan & Publish)

- **本地发现 (`skillhub scan`):**
  - CLI 遍历当前工作目录（自动忽略 `.git`, `node_modules` 等）。
  - 寻找符合 Open Agent Skills Standard 的 `SKILL.md` 目录。
  - 对比云端状态，输出报告：_“发现 2 个本地未发布的 Skill，3 个需要 update 的 Skill”_。
- **一键发布 (`skillhub push`):**
  - 执行 `skillhub push @namespace/skill-name -t latest`。
  - **预检 (Lint):** 严格校验 `SKILL.md` 的 YAML Frontmatter 是否包含必备字段 (`name`, `description`)。
  - 打包为 tarball 并直传 S3，更新数据库元数据。

### 4.4 消费与分发 (Consume & Distribute)

支持静态与动态双轨消费模式。

**轨道 A：静态安装 (CLI 主导)**

- 执行 `skillhub install @namespace/skill-name`。
- CLI 从 S3 下载制品并解压至全局缓存 `~/.skillhub/@namespace/skill-name/`。
- **Symlink Magic:** 自动探测当前目录的 AI 环境：
  - 若存在 `.claude/` (Claude Code)，则软链至 `.claude/skills/`。
  - 若存在 `.agents/` (Codex/OpenClaw)，则软链至 `.agents/skills/`。
- **更新 (`skillhub update`):** 一键拉取本地已软链 Skill 的最新 `latest` 标签，覆盖缓存。

**轨道 B：动态发现 (MCP 赋能)**

- 将 `mcp-skillhub` 配置到 Agent 的全局 MCP 列表中。
- Agent 遇到未知任务时，调用 `search_skills({ query: "部署前端" })`。
- Skillhub 返回企业内部可用的 Skill 列表及调用说明，Agent 根据返回的说明，自主决定下一步动作（如执行某个 CLI 脚本或发起 API 请求）。

## 5. 权限控制 (RBAC)

- **Global Admin:** 拥有全局所有 Namespace 的管理、删除权限。
- **Namespace Maintainer:** 拥有特定 `@namespace` 下的 Push、修改权限。
- **Viewer:** (企业内部默认权限) 拥有所有非私有 (Public/Internal) Skill 的 Pull 和 Search 权限。

## 6. 后续演进冗余设计 (Future Proofing)

1.  **依赖管理:** 数据库模型预留 `dependencies: JSONB` 字段，为未来的 `skills.yaml` 级联解析做准备。
2.  **Telemetry (遥测):** CLI 层面预留使用频次上报接口，未来可在 Web UI 上展示“企业内最受欢迎的 10 大 AI 技能”。
