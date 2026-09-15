# aiterm 开发计划

**版本：v0.1**

本文档基于 [Architecture.md](Architecture.md) 制定，将架构设计落地为可执行的分阶段开发计划，每个阶段包含目标、任务清单、交付物与验收标准。

---

# 1. 总体说明

## 1.1 项目目标

构建一个本地、AI-native 的 SSH Remote Terminal Runtime，为人类和 AI Agent 提供统一的远程服务器连接、Shell 执行、交互会话和文件传输能力。

## 1.2 技术栈

| 关注点 | 选型 | 说明 |
|--------|------|------|
| 语言 | TypeScript (strict) | 架构文档推荐 |
| 运行时 | Node.js (LTS) | 跨平台、SSH 生态成熟 |
| SSH 底层库 | `ssh2` | Node.js 最成熟的 SSH 实现 |
| CLI 框架 | `commander` | 子命令结构契合需求 |
| 构建 | `tsup`（esbuild） | 快、零配置、产出 ESM+CJS |
| 测试 | `vitest` | 原生 TS、快、API 友好 |
| Lint/Format | `eslint` + `prettier` | 社区标准 |
| 本地 PTY | `node-pty` | 交互式终端 resize/signal |

## 1.3 阶段总览

| 阶段 | 名称 | 核心交付 | 依赖 |
|------|------|----------|------|
| Phase 0 | 工程脚手架 | 可构建、可测试、可 Lint 的 TS 工程 | 无 |
| Phase 1 | SSH Config | Host 配置解析与 CLI 查询 | Phase 0 |
| Phase 2 | SSH Connection | SSH 连接 + 交互式会话 | Phase 1 |
| Phase 3 | Exec | 远程命令执行 | Phase 2 |
| Phase 4 | Transfer | 文件上传/下载 | Phase 2 |
| Phase 5 | Skill | AI Agent 接入层 | Phase 1–4 |
| Phase 6 | Desktop Client | 图形化客户端 | Phase 1–4 |

## 1.4 阶段依赖关系

```text
Phase 0 (脚手架)
   ↓
Phase 1 (SSH Config)
   ↓
Phase 2 (SSH Connection)
   ↓
┌────────┴────────┐
Phase 3 (Exec)   Phase 4 (Transfer)   ← 可并行
└────────┬────────┘
   ↓
Phase 5 (Skill)  →  Phase 6 (Desktop)
```

## 1.5 通用验收标准（所有阶段）

每个阶段完成后，必须同时满足以下通用标准：

- `npm run build` 构建成功，产出 `dist/`
- `npm run lint` 无错误
- `npm run typecheck` 类型检查通过
- `npm test` 所有测试通过
- 新增代码有对应单元测试覆盖
- 模块依赖方向符合架构文档 [§33–§34](Architecture.md)：`CLI → Runtime → SSH Config/SSH → Platform`，核心层不反向依赖 UI

---

# 2. Phase 0：工程脚手架

## 2.1 目标

搭建可构建、可测试、可 Lint 的 TypeScript 工程骨架，为后续所有阶段提供工程基础。

## 2.2 任务清单

| 编号 | 任务 | 产出文件 |
|------|------|----------|
| 0.1 | 配置 `package.json`（name/scripts/bin/依赖） | `package.json` |
| 0.2 | 配置 `tsconfig.json`（strict、ESM、路径别名） | `tsconfig.json` |
| 0.3 | 配置 `tsup.config.ts` 构建 | `tsup.config.ts` |
| 0.4 | 配置 eslint + prettier | `eslint.config.js`、`.prettierrc`、`.prettierignore` |
| 0.5 | 配置 vitest | `vitest.config.ts` |
| 0.6 | 创建目录骨架 | `src/` 全部子目录 |
| 0.7 | 创建 `errors/errors.ts` 错误基类 | `src/errors/errors.ts` |
| 0.8 | 创建 `index.ts` CLI 入口占位 | `src/index.ts` |
| 0.9 | 配置 `.gitignore`（node_modules/dist 等） | `.gitignore` |

## 2.3 目录骨架

```text
src/
├── cli/
│   ├── commands/
│   └── renderer/
├── runtime/
├── ssh-config/
├── ssh/
├── terminal/
├── platform/
├── errors/
└── index.ts
tests/
├── ssh-config/
├── ssh/
├── runtime/
└── cli/
```

## 2.4 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A0.1 | `npm run build` 成功产出 `dist/` | 执行命令检查 |
| A0.2 | `npm run lint` 无错误 | 执行命令检查 |
| A0.3 | `npm run typecheck` 通过 | 执行命令检查 |
| A0.4 | `npm test` 可运行（空套件通过） | 执行命令检查 |
| A0.5 | `aiterm --version` 可输出版本号 | 运行 CLI |
| A0.6 | `aiterm --help` 可输出帮助信息 | 运行 CLI |
| A0.7 | 目录结构与架构文档 [§32](Architecture.md) 一致 | 人工核对 |
| A0.8 | `errors/errors.ts` 定义统一错误基类 | 代码审查 |

---

# 3. Phase 1：SSH Config

## 3.1 目标

实现 `~/.ssh/config` 的读取、解析与 Target 解析，提供 `config` 与 `host` 两组 CLI 命令。

对应架构文档 [§6–§10](Architecture.md)、[§38](Architecture.md)。

## 3.2 任务清单

| 编号 | 任务 | 模块 | 产出文件 |
|------|------|------|----------|
| 1.1 | 平台路径定位 `~/.ssh/config` | platform | `src/platform/paths.ts` |
| 1.2 | 定义 `HostBlock` / `SSHConfig` / `ResolvedHost` 类型 | ssh-config | `src/ssh-config/model.ts` |
| 1.3 | SSH Config 文本解析器（Lexer） | ssh-config | `src/ssh-config/parser.ts` |
| 1.4 | SSH Config 文件加载器 | ssh-config | `src/ssh-config/loader.ts` |
| 1.5 | Host Resolver（Target → ResolvedHost） | ssh-config | `src/ssh-config/resolver.ts` |
| 1.6 | `aiterm config path` / `config check` 命令 | cli | `src/cli/commands/config.ts` |
| 1.7 | `aiterm host list` / `host show` 命令 | cli | `src/cli/commands/host.ts` |
| 1.8 | Runtime 组装 config + resolver | runtime | `src/runtime/runtime.ts` |
| 1.9 | CLI 输出格式化 | cli | `src/cli/renderer/` |

## 3.3 核心数据模型

```typescript
interface HostBlock {
    patterns: string[];
    directives: Map<string, string[]>;
}

interface SSHConfig {
    blocks: HostBlock[];
}

interface ResolvedHost {
    host: string;
    port: number;
    username: string;
    identityFiles: string[];
}
```

## 3.4 支持的指令（第一阶段）

```text
Host
HostName
User
Port
IdentityFile
```

## 3.5 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A1.1 | Parser 能正确解析标准 SSH Config 格式 | 单元测试：给定 config 文本，断言 HostBlock 结构 |
| A1.2 | Parser 能处理多 Host 块 | 单元测试 |
| A1.3 | Parser 能处理 `IdentityFile` 多值 | 单元测试 |
| A1.4 | Resolver 能将 Target 解析为 ResolvedHost | 单元测试：`production` → 正确 host/port/user/identityFiles |
| A1.5 | Resolver 能展开 `~` 为 home 目录 | 单元测试 |
| A1.6 | Resolver 对缺失指令使用默认值（Port=22 等） | 单元测试 |
| A1.7 | `aiterm config path` 输出 SSH Config 路径 | CLI 集成测试 |
| A1.8 | `aiterm config check` 检查配置有效性并报告问题 | CLI 集成测试 |
| A1.9 | `aiterm host list` 列出所有 Host | CLI 集成测试 |
| A1.10 | `aiterm host show production` 输出解析结果 | CLI 集成测试，输出格式： |
| | | ``` Target: production / Host: ... / Port: ... / User: ... / Identity: ... ``` |
| A1.11 | 未知 Target 时给出清晰错误提示 | CLI 集成测试 |
| A1.12 | 模块依赖方向正确：ssh-config 不依赖 ssh | 代码审查 |

## 3.6 测试用例示例

```text
输入 config:
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519

期望 ResolvedHost:
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "identityFiles": ["/home/user/.ssh/id_ed25519"]
}
```

---

# 4. Phase 2：SSH Connection & 交互会话

## 4.1 目标

实现 SSH 连接建立、私钥认证、Known Hosts 校验，以及交互式 PTY 会话，支持 `aiterm ssh <target>` 登录远程服务器。

对应架构文档 [§11–§17](Architecture.md)、[§20–§21](Architecture.md)、[§39](Architecture.md)。

## 4.2 任务清单

| 编号 | 任务 | 模块 | 产出文件 |
|------|------|------|----------|
| 2.1 | SSH Transport Adapter（封装 ssh2） | ssh | `src/ssh/transport.ts` |
| 2.2 | Known Hosts 校验（Match/Unknown/Mismatch） | ssh | `src/ssh/known-hosts.ts` |
| 2.3 | IdentityFile 私钥认证 | ssh | `src/ssh/authentication.ts` |
| 2.4 | SSHClient（connect → SSHConnection） | ssh | `src/ssh/client.ts` |
| 2.5 | SSHConnection 接口实现 | ssh | `src/ssh/connection.ts` |
| 2.6 | SSHSession（PTY 双向流） | ssh | `src/ssh/session.ts` |
| 2.7 | 本地终端适配（stdin/stdout/resize/signal） | terminal | `src/terminal/terminal.ts` |
| 2.8 | PTY 管理与 resize | terminal | `src/terminal/pty.ts`、`resize.ts` |
| 2.9 | `aiterm ssh <target>` 命令 | cli | `src/cli/commands/ssh.ts` |
| 2.10 | Runtime 集成 SSHClient | runtime | 更新 `runtime.ts` |

## 4.3 核心接口

```typescript
interface SSHClient {
    connect(host: ResolvedHost): Promise<SSHConnection>;
}

interface SSHConnection {
    exec(command: string): Promise<ExecResult>;
    createSession(options?: SessionOptions): Promise<SSHSession>;
    close(): Promise<void>;
}

interface SSHSession {
    write(data: Uint8Array): Promise<void>;
    onData(callback: (data: Uint8Array) => void): void;
    resize(cols: number, rows: number): Promise<void>;
    close(): Promise<void>;
}
```

## 4.4 Known Hosts 三态处理

| 状态 | 行为 |
|------|------|
| Match | 继续连接 |
| Unknown | 首次连接，CLI 提示确认（`Continue? [y/N]`） |
| Mismatch | 默认拒绝连接，不允许 `StrictHostKeyChecking=no` 绕过 |

## 4.5 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A2.1 | SSHClient 能用 ResolvedHost 建立连接 | 集成测试（需测试 SSH 服务器） |
| A2.2 | IdentityFile 私钥认证成功 | 集成测试 |
| A2.3 | 认证失败时给出清晰错误 | 集成测试 |
| A2.4 | Known Hosts Match 时正常连接 | 集成测试 |
| A2.5 | Known Hosts Unknown 时提示用户确认 | 集成测试 |
| A2.6 | Known Hosts Mismatch 时拒绝连接 | 集成测试 |
| A2.7 | `aiterm ssh production` 能登录远程 Shell | 手动测试：可执行远程命令如 `ls`、`uname -a` |
| A2.8 | 交互式会话支持 stdin/stdout 双向流 | 手动测试：输入命令有输出 |
| A2.9 | 终端 resize 后远程 PTY 同步 resize | 手动测试：调整窗口大小 |
| A2.10 | Ctrl+C 等 signal 正确传递到远程 | 手动测试 |
| A2.11 | `exit` 或 Ctrl+D 能正常退出会话 | 手动测试 |
| A2.12 | Transport Adapter 隔离 ssh2，上层不直接依赖 ssh2 | 代码审查：`connection.ts` 等不 import ssh2 |
| A2.13 | 连接超时与网络错误有友好提示 | 集成测试 |

---

# 5. Phase 3：Exec

## 5.1 目标

实现一次性远程命令执行，返回 stdout/stderr/exitCode，支持 `aiterm exec <target> -- <command>`。

对应架构文档 [§13–§15](Architecture.md)、[§40](Architecture.md)。

## 5.2 任务清单

| 编号 | 任务 | 模块 | 产出文件 |
|------|------|------|----------|
| 3.1 | ExecResult 类型定义 | ssh | `src/ssh/exec.ts` |
| 3.2 | SSHConnection.exec() 实现 | ssh | 更新 `connection.ts` |
| 3.3 | `aiterm exec <target> -- <cmd>` 命令 | cli | `src/cli/commands/exec.ts` |
| 3.4 | Exec 输出格式化（stdout/stderr/exit code） | cli | `src/cli/renderer/` |

## 5.3 核心数据模型

```typescript
interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
```

## 5.4 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A3.1 | `exec("uname -a")` 返回正确 stdout | 集成测试 |
| A3.2 | `exec("docker ps")` 返回正确 stdout | 集成测试 |
| A3.3 | 命令失败时 exitCode 非 0 | 集成测试：`exec("exit 1")` |
| A3.4 | stderr 内容正确返回 | 集成测试：执行输出 stderr 的命令 |
| A3.5 | `aiterm exec production -- uname -a` CLI 可用 | CLI 集成测试 |
| A3.6 | `aiterm exec production -- docker ps` CLI 可用 | CLI 集成测试 |
| A3.7 | 命令执行超时有处理 | 集成测试 |
| A3.8 | Exec 与 Session 使用不同 Channel，互不干扰 | 代码审查 |
| A3.9 | 命令中的特殊字符正确传递（不本地解析） | 集成测试：`exec("echo 'hello world'")` |

---

# 6. Phase 4：Transfer

## 6.1 目标

实现基于 SFTP 的文件上传与下载，支持 `aiterm upload` 与 `aiterm download`。

对应架构文档 [§18–§19](Architecture.md)、[§41](Architecture.md)。

## 6.2 任务清单

| 编号 | 任务 | 模块 | 产出文件 |
|------|------|------|----------|
| 4.1 | SFTP Transfer 接口与实现 | ssh | `src/ssh/transfer.ts` |
| 4.2 | `aiterm upload <target> <local> <remote>` 命令 | cli | `src/cli/commands/upload.ts` |
| 4.3 | `aiterm download <target> <remote> <local>` 命令 | cli | `src/cli/commands/download.ts` |
| 4.4 | 传输进度显示 | cli | `src/cli/renderer/` |

## 6.3 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A4.1 | `upload` 能上传单个文件到远程 | 集成测试：上传后远程文件存在且内容一致 |
| A4.2 | `download` 能从远程下载单个文件 | 集成测试：下载后本地文件内容一致 |
| A4.3 | 上传/下载后文件内容一致（二进制校验） | 集成测试：MD5 对比 |
| A4.4 | 二进制文件（如 .exe/.tar.gz）正确传输 | 集成测试 |
| A4.5 | 远程路径不存在时给出清晰错误 | 集成测试 |
| A4.6 | 本地路径不存在时给出清晰错误 | 集成测试 |
| A4.7 | 传输进度有显示 | 手动测试 |
| A4.8 | `aiterm upload production ./app.exe /tmp/app.exe` 可用 | CLI 集成测试 |
| A4.9 | `aiterm download production /var/log/app.log ./app.log` 可用 | CLI 集成测试 |
| A4.10 | Transfer 不区分文件类型（exe/tar.gz/bin/png/sql 统一处理） | 代码审查：无文件类型分支 |

---

# 7. Phase 5：Skill

## 7.1 目标

创建 aiterm Skill 层，让 AI Agent（Codex / Claude Code 等）能通过 Skill 调用 aiterm CLI，无需直接操作 SSH 协议。

对应架构文档 [§28–§29](Architecture.md)、[§42](Architecture.md)。

## 7.2 任务清单

| 编号 | 任务 | 产出 |
|------|------|------|
| 5.1 | 编写 `SKILL.md`：描述何时及如何使用 aiterm | `skills/aiterm/SKILL.md` |
| 5.2 | 编写 `commands.md`：可用命令速查 | `skills/aiterm/commands.md` |
| 5.3 | 编写示例集 | `skills/aiterm/examples/` |
| 5.4 | 确保 CLI 输出对 AI 友好（结构化、可解析） | 审查并优化 CLI 输出 |

## 7.3 Skill 内容覆盖

```text
什么时候使用 aiterm
如何查找 Host
如何执行远程命令
如何上传文件
如何下载文件
如何处理错误
```

## 7.4 验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|----------|
| A5.1 | `SKILL.md` 完整描述 aiterm 用途与能力 | 人工审查 |
| A5.2 | `commands.md` 列出所有可用命令及参数 | 人工审查 |
| A5.3 | examples 覆盖 host/exec/upload/download 场景 | 人工审查 |
| A5.4 | AI Agent 能根据 Skill 正确调用 `aiterm host list` | 手动测试 |
| A5.5 | AI Agent 能根据 Skill 正确调用 `aiterm exec` | 手动测试 |
| A5.6 | CLI 输出可被 AI 解析（JSON 或清晰文本格式） | 代码审查 |
| A5.7 | 错误输出对 AI 可读（含可操作建议） | 代码审查 |

---

# 8. Phase 6：Desktop Client（未来）

## 8.1 目标

提供图形化桌面客户端，复用同一 SSH Core，提供 Host 管理、SSH Terminal、文件上传下载、会话管理、AI Agent 集成。

对应架构文档 [§43–§44](Architecture.md)。

## 8.2 任务清单（待规划）

| 编号 | 任务 |
|------|------|
| 6.1 | 选定桌面框架（Electron / Tauri） |
| 6.2 | Host 管理界面 |
| 6.3 | SSH Terminal 组件 |
| 6.4 | 文件上传/下载界面 |
| 6.5 | 会话管理 |
| 6.6 | AI Agent 集成入口 |

## 8.3 验收标准（待细化）

| 编号 | 验收项 |
|------|--------|
| A6.1 | Desktop Client 复用 SSH Core，不重复实现 SSH 逻辑 |
| A6.2 | Host 管理可增删改查 |
| A6.3 | SSH Terminal 功能与 CLI `aiterm ssh` 一致 |
| A6.4 | 文件传输功能与 CLI 一致 |

---

# 9. 跨阶段约定

## 9.1 错误处理

- 所有模块使用 `src/errors/errors.ts` 中定义的统一错误基类
- 错误信息对人类和 AI 都可读
- 网络错误、认证错误、配置错误分类清晰

## 9.2 日志

- 关键操作有日志（连接、执行、传输）
- 日志级别可控（debug/info/warn/error）
- 不输出敏感信息（私钥内容、密码）

## 9.3 跨平台

- 路径处理兼容 Windows / macOS / Linux
- 使用 `platform/paths.ts` 统一获取平台相关路径
- 不硬编码路径分隔符

## 9.4 测试策略

| 层级 | 方式 | 工具 |
|------|------|------|
| 单元测试 | 纯函数/类隔离测试 | vitest |
| 集成测试 | 模块组合测试 | vitest + 测试 SSH 服务器 |
| CLI 测试 | 命令行端到端 | vitest + execa |
| 手动测试 | 交互式会话/PTY | 人工 |

## 9.5 依赖方向红线

严格遵循架构文档 [§33–§34](Architecture.md)：

```text
CLI → Runtime → SSH Config / SSH → Platform
```

**禁止**：
- SSH Core 反向依赖 CLI
- SSH Config 反向依赖 CLI
- 任何模块直接 import `ssh2`（必须经 Transport Adapter）

---

# 10. 里程碑

| 里程碑 | 完成阶段 | 标志 |
|--------|----------|------|
| M0 | Phase 0 | 工程可构建可测试 |
| M1 | Phase 1 | `aiterm host list/show` 可用 |
| M2 | Phase 2 | `aiterm ssh production` 可登录 |
| M3 | Phase 3 | `aiterm exec` 可执行远程命令 |
| M4 | Phase 4 | `aiterm upload/download` 可传文件 |
| M5 | Phase 5 | AI Agent 可通过 Skill 使用 aiterm |
| M6 | Phase 6 | Desktop Client 可用 |

---

# 11. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| `ssh2` 原生模块编译问题 | Phase 2 阻塞 | 预装构建工具链，或使用 prebuilt |
| Windows PTY 兼容性 | Phase 2 交互异常 | 使用 `node-pty`，提前在 Windows 验证 |
| 测试 SSH 服务器搭建 | 集成测试困难 | 使用 docker 容器提供测试 SSH 服务 |
| Known Hosts 安全与易用性平衡 | 用户体验差 | Unknown 态提供交互确认，不默认禁用 |
| AI 输出可解析性 | Phase 5 受阻 | Phase 1–4 即保持结构化输出 |