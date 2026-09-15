# aiterm

AI-Native 的本地 SSH Remote Terminal Runtime，为人类和 AI Agent 提供统一的远程连接、Shell 执行、交互会话与文件传输能力。

## 技术栈

TypeScript (strict, ESM) + Node.js LTS | SSH: `ssh2`（经 Transport Adapter 隔离）| CLI: `commander` | 构建: `tsup` | 测试: `vitest` | Lint: `eslint` + `prettier`

## 常用命令

```bash
npm run build && npm run lint && npm run typecheck && npm test  # 改动后必跑全
npm run dev          # 开发模式
```

CLI（Phase 1+ 逐步可用）：`config path|check`、`host list|show <t>`、`ssh <t>`、`exec <t> -- <cmd>`、`upload|download <t> <src> <dst>`

## 文档体系与使用规范

| 文档 | 用途 | 何时读 |
|------|------|--------|
| [Architecture.md](doc/Architecture.md) | 系统架构与设计原则 | 理解整体设计时 |
| [Development-Plan.md](doc/Development-Plan.md) | 分阶段计划与验收标准 | 开始新 Phase 前 |
| [Progress.md](doc/Progress.md) | 当前进度与下一步 | 每次开发/交接前必读 |
| [Coding-Standards.md](doc/Coding-Standards.md) | 命名/组织/类型/注释规范 | 写代码前 |
| [CLI-Spec.md](doc/CLI-Spec.md) | 命令参数/输出/退出码 | 实现 CLI 命令前 |
| [Testing-Strategy.md](doc/Testing-Strategy.md) | 测试分层/fixture/覆盖率 | 写测试前 |
| [Error-Spec.md](doc/Error-Spec.md) | 错误类型/码/消息规范 | 定义错误前 |
| [Security-Guidelines.md](doc/Security-Guidelines.md) | 密钥/known_hosts/日志红线 | 接触 SSH 前 |
| [Environment-Setup.md](doc/Environment-Setup.md) | 环境搭建 | 首次配置时 |

**Progress.md 维护规则**：完成 Step 或验收项时更新状态；`[!]` 阻塞项必写原因；顶部更新日期；不复制计划内容，只记状态。

## 开发方式

### 模块依赖方向（红线）

`CLI → Runtime → SSH Config / SSH → Platform`，核心层禁止反向依赖 UI；禁止直接 import `ssh2`，必须经 `src/ssh/transport.ts`。

### 核心设计原则

- **SSH = 怎么连接**，**Shell Command = 连接后做什么**
- `aiterm` 不理解远程软件（Docker/K8s/Linux 等），只负责连接与传输字符串
- 不设计 RemoteProvider / DockerAdapter 等领域抽象
- Target 与 ResolvedHost 必须分离，SSHClient 只接收 ResolvedHost

### 目录结构与开发阶段

`src/` 下：`cli/commands/`(ssh/exec/upload/download/host/config)、`runtime/`(编排)、`ssh-config/`(parser/resolver/loader/model/path)、`ssh/`(client/connection/session/exec/transfer/transport)、`terminal/`、`platform/`、`errors/`。按 Phase 0–6 推进（详见开发计划）：脚手架 → SSH Config → SSH Connection → Exec → Transfer → Skill → Desktop。每阶段完成后 `build`/`lint`/`typecheck`/`test` 必须全绿。新增代码须有单元测试；不主动 commit；不输出敏感信息（私钥、密码）。