# aiterm 开发进度

**最近更新：2026-09-17**

本文件追踪 [Development-Plan.md](Development-Plan.md) 中各阶段与验收项的实际完成状态。维护规则见 [AGENTS.md](../AGENTS.md) 文档使用规范。

---

## 图例

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[~]` | 进行中 |
| `[x]` | 已完成 |
| `[!]` | 阻塞（须注明原因） |

---

## 当前焦点

Phase 4 — Transfer（Phase 3 已完成）

---

## Phase 0：工程脚手架

| Step | 状态 | 备注 |
|------|------|------|
| 0.1 package.json 配置 | [x] | version 0.1.0、type:module、bin、四件套 scripts |
| 0.2 tsconfig.json 配置 | [x] | strict、ESNext+Bundler、@/* 别名 |
| 0.3 tsup.config.ts 构建 | [x] | esm、node20、dts、shebang banner |
| 0.4 eslint + prettier 配置 | [x] | flat config（eslint.config.js）+ .prettierrc |
| 0.5 vitest 配置 | [x] | @ 别名、passWithNoTests |
| 0.6 目录骨架创建 | [x] | src/tests 全部子目录 + .gitkeep |
| 0.7 errors/errors.ts 错误基类 | [x] | AitermError + 7 子类 + getExitCode |
| 0.8 index.ts CLI 入口占位 | [x] | commander、全局选项、错误边界 |
| 0.9 .gitignore 配置 | [x] | 追加 tests/fixtures/keys/、.env* |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A0.1 | `npm run build` 成功产出 dist/ | [x] |
| A0.2 | `npm run lint` 无错误 | [x] |
| A0.3 | `npm run typecheck` 通过 | [x] |
| A0.4 | `npm test` 可运行 | [x] |
| A0.5 | `aiterm --version` 可用 | [x] |
| A0.6 | `aiterm --help` 可用 | [x] |
| A0.7 | 目录结构与架构文档一致 | [x] |
| A0.8 | errors/errors.ts 定义统一错误基类 | [x] |

---

## Phase 1：SSH Config

| Step | 状态 | 备注 |
|------|------|------|
| 1.1 platform/paths.ts 平台路径 | [x] | getSshDir/getSshConfigPath/expandTilde |
| 1.2 ssh-config/model.ts 类型定义 | [x] | HostBlock/SSHConfig/ResolvedHost/SUPPORTED_DIRECTIVES |
| 1.3 ssh-config/parser.ts 解析器 | [x] | parse/getNamedHosts，支持 Host/HostName/User/Port/IdentityFile |
| 1.4 ssh-config/loader.ts 加载器 | [x] | load/check，ENOENT → ConfigError |
| 1.5 ssh-config/resolver.ts Target 解析 | [x] | resolve，展开 ~、默认值、未知 Target 抛 ConfigError |
| 1.6 cli/commands/config.ts | [x] | config path / config check |
| 1.7 cli/commands/host.ts | [x] | host list / host show <target> |
| 1.8 runtime/runtime.ts 组装 | [x] | Runtime 类封装 loadConfig/resolveTarget/listHosts/checkConfig |
| 1.9 cli/renderer 输出格式化 | [x] | formatConfigPath/Check/formatHostList/Show，人类+JSON 双格式 |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A1.1 | Parser 解析标准 SSH Config | [x] |
| A1.2 | Parser 处理多 Host 块 | [x] |
| A1.3 | Parser 处理 IdentityFile 多值 | [x] |
| A1.4 | Resolver 解析 Target → ResolvedHost | [x] |
| A1.5 | Resolver 展开 `~` 为 home 目录 | [x] |
| A1.6 | Resolver 缺失指令使用默认值 | [x] |
| A1.7 | `aiterm config path` 可用 | [x] |
| A1.8 | `aiterm config check` 可用 | [x] |
| A1.9 | `aiterm host list` 可用 | [x] |
| A1.10 | `aiterm host show` 可用 | [x] |
| A1.11 | 未知 Target 给出清晰错误 | [x] |
| A1.12 | 模块依赖方向正确 | [x] |

---

## Phase 2：SSH Connection & 交互会话

| Step | 状态 | 备注 |
|------|------|------|
| 2.1 ssh/transport.ts Transport Adapter | [x] | createClient() + re-export ssh2 类型 |
| 2.2 ssh/known-hosts.ts | [x] | verifyKnownHosts/appendToKnownHosts/computeFingerprint，Match/Unknown/Mismatch 三态 |
| 2.3 ssh/authentication.ts | [x] | loadPrivateKey/buildCredentials，IdentityFile 认证 |
| 2.4 ssh/client.ts SSHClient | [x] | connect(host, options) → SSHConnection，hostVerifier + 错误分类 |
| 2.5 ssh/connection.ts SSHConnection | [x] | exec/createSession/close，SSHConnectionImpl |
| 2.6 ssh/session.ts SSHSession | [x] | write/onData/resize/close，SSHSessionImpl |
| 2.7 terminal/terminal.ts 本地终端适配 | [x] | attachTerminal 双向绑定 stdin/stdout/resize |
| 2.8 terminal/pty.ts + resize.ts | [x] | createPTYOptions/watchResize |
| 2.9 cli/commands/ssh.ts | [x] | aiterm ssh <target>，Known Hosts 交互确认 |
| 2.10 runtime 集成 SSHClient | [x] | Runtime.connect() 委托 SSHClient |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A2.1 | SSHClient 用 ResolvedHost 建立连接 | [x] |
| A2.2 | IdentityFile 私钥认证成功 | [x] |
| A2.3 | 认证失败给出清晰错误 | [x] |
| A2.4 | Known Hosts Match 正常连接 | [x] |
| A2.5 | Known Hosts Unknown 提示确认 | [x] |
| A2.6 | Known Hosts Mismatch 拒绝连接 | [x] |
| A2.7 | `aiterm ssh production` 可登录 | [x] |
| A2.8 | 交互式会话双向流 | [x] |
| A2.9 | 终端 resize 同步 | [x] |
| A2.10 | Ctrl+C 等 signal 传递 | [x] |
| A2.11 | exit/Ctrl+D 正常退出 | [x] |
| A2.12 | Transport Adapter 隔离 ssh2 | [x] |
| A2.13 | 连接超时与网络错误友好提示 | [x] |

---

## Phase 3：Exec

| Step | 状态 | 备注 |
|------|------|------|
| 3.1 ssh/exec.ts ExecResult 类型 | [x] | ExecResult + ExecOptions |
| 3.2 SSHConnection.exec() 实现 | [x] | 含超时、cleanup、settled 防重复 |
| 3.3 cli/commands/exec.ts | [x] | registerExecCommand，--timeout 选项 |
| 3.4 Exec 输出格式化 | [x] | formatExecResult，人类+JSON 双格式 |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A3.1 | `exec("uname -a")` 返回正确 stdout | [x] |
| A3.2 | `exec("docker ps")` 返回正确 stdout | [x] |
| A3.3 | 命令失败 exitCode 非 0 | [x] |
| A3.4 | stderr 内容正确返回 | [x] |
| A3.5 | `aiterm exec production -- uname -a` 可用 | [x] |
| A3.6 | `aiterm exec production -- docker ps` 可用 | [x] |
| A3.7 | 命令执行超时处理 | [x] |
| A3.8 | Exec 与 Session 使用不同 Channel | [x] |
| A3.9 | 特殊字符正确传递 | [x] |

---

## Phase 4：Transfer

| Step | 状态 | 备注 |
|------|------|------|
| 4.1 ssh/transfer.ts SFTP | [ ] | |
| 4.2 cli/commands/upload.ts | [ ] | |
| 4.3 cli/commands/download.ts | [ ] | |
| 4.4 传输进度显示 | [ ] | |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A4.1 | upload 上传单个文件 | [ ] |
| A4.2 | download 下载单个文件 | [ ] |
| A4.3 | 传输后文件内容一致（二进制校验） | [ ] |
| A4.4 | 二进制文件正确传输 | [ ] |
| A4.5 | 远程路径不存在清晰错误 | [ ] |
| A4.6 | 本地路径不存在清晰错误 | [ ] |
| A4.7 | 传输进度显示 | [ ] |
| A4.8 | `aiterm upload` 可用 | [ ] |
| A4.9 | `aiterm download` 可用 | [ ] |
| A4.10 | Transfer 不区分文件类型 | [ ] |

---

## Phase 5：Skill

| Step | 状态 | 备注 |
|------|------|------|
| 5.1 skills/aiterm/SKILL.md | [ ] | |
| 5.2 skills/aiterm/commands.md | [ ] | |
| 5.3 skills/aiterm/examples/ | [ ] | |
| 5.4 CLI 输出对 AI 友好 | [ ] | |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A5.1 | SKILL.md 完整描述用途与能力 | [ ] |
| A5.2 | commands.md 列出所有命令 | [ ] |
| A5.3 | examples 覆盖核心场景 | [ ] |
| A5.4 | AI Agent 可调用 host list | [ ] |
| A5.5 | AI Agent 可调用 exec | [ ] |
| A5.6 | CLI 输出可被 AI 解析 | [ ] |
| A5.7 | 错误输出对 AI 可读 | [ ] |

---

## Phase 6：Desktop Client（未来）

| Step | 状态 | 备注 |
|------|------|------|
| 6.1 桌面框架选型 | [ ] | |
| 6.2 Host 管理界面 | [ ] | |
| 6.3 SSH Terminal 组件 | [ ] | |
| 6.4 文件上传/下载界面 | [ ] | |
| 6.5 会话管理 | [ ] | |
| 6.6 AI Agent 集成入口 | [ ] | |

**验收**：

| 编号 | 验收项 | 状态 |
|------|--------|------|
| A6.1 | 复用 SSH Core 不重复实现 | [ ] |
| A6.2 | Host 管理增删改查 | [ ] |
| A6.3 | SSH Terminal 与 CLI 一致 | [ ] |
| A6.4 | 文件传输与 CLI 一致 | [ ] |

---

## 阻塞与风险记录

| 日期 | 阶段 | 问题 | 状态 |
|------|------|------|------|
| — | — | （暂无） | — |