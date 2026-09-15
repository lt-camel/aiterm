# aiterm CLI 设计规范

**版本：v0.1**

定义 `aiterm` CLI 的命令结构、参数、选项、输出格式与退出码。对应架构文档 [§30–§31](Architecture.md)。

---

# 1. 命令结构

```text
aiterm
├── config
│   ├── path          # 显示 SSH Config 路径
│   └── check         # 检查 SSH Config 有效性
├── host
│   ├── list          # 列出所有 Host
│   └── show <target> # 显示解析结果
├── ssh <target>      # 交互式 SSH 会话
├── exec <target> -- <command>  # 执行远程命令
├── upload <target> <local> <remote>   # 上传文件
└── download <target> <remote> <local> # 下载文件
```

未来扩展：`forward` / `tunnel` / `session` / `skill`。

---

# 2. 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 输出 JSON 格式（供 AI/脚本解析） | false |
| `--config <path>` | 指定 SSH Config 路径 | `~/.ssh/config` |
| `--debug` | 输出调试日志 | false |
| `--version, -v` | 输出版本号 | — |
| `--help, -h` | 输出帮助 | — |

`--json` 选项为 Phase 5 Skill 层铺路，让 AI Agent 可解析输出。

---

# 3. 命令详细定义

## 3.1 config path

```bash
aiterm config path
```

输出 SSH Config 文件路径。

人类格式：
```text
~/.ssh/config
```

JSON 格式（`--json`）：
```json
{ "path": "/home/user/.ssh/config" }
```

## 3.2 config check

```bash
aiterm config check
```

检查 SSH Config 语法与可达性，报告问题。

人类格式：
```text
✓ Config syntax OK
✗ Host 'prod' missing HostName
```

JSON 格式：
```json
{ "ok": false, "issues": [{ "host": "prod", "problem": "missing HostName" }] }
```

## 3.3 host list

```bash
aiterm host list
```

列出所有 Host。

人类格式：
```text
production   192.168.1.100:22   root
staging      10.0.0.20:22       deploy
```

JSON 格式：
```json
[{ "target": "production", "host": "192.168.1.100", "port": 22, "user": "root" }]
```

## 3.4 host show

```bash
aiterm host show <target>
```

输出解析后的 ResolvedHost。

人类格式：
```text
Target: production

Host:     192.168.1.100
Port:     22
User:     root
Identity: ~/.ssh/id_ed25519
```

JSON 格式：
```json
{ "target": "production", "host": "192.168.1.100", "port": 22, "username": "root", "identityFiles": ["..."] }
```

## 3.5 ssh

```bash
aiterm ssh <target>
```

建立交互式 SSH 会话，连接本地终端到远程 PTY。无结构化输出，直接转发字节流。

## 3.6 exec

```bash
aiterm exec <target> -- <command>
```

执行一次性远程命令。

人类格式：直接输出 stdout，stderr 输出到 stderr，退出码即远程命令退出码。

JSON 格式：
```json
{ "stdout": "...", "stderr": "...", "exitCode": 0 }
```

## 3.7 upload / download

```bash
aiterm upload <target> <local-path> <remote-path>
aiterm download <target> <remote-path> <local-path>
```

人类格式：显示进度条，完成后输出 `✓ uploaded <local> → <remote>`。

JSON 格式：
```json
{ "ok": true, "bytes": 1024, "local": "...", "remote": "..." }
```

---

# 4. 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 通用错误 |
| 2 | 配置错误（SSH Config 解析失败、Target 未知） |
| 3 | 连接错误（网络、超时） |
| 4 | 认证错误（私钥无效、被拒绝） |
| 5 | Known Hosts 错误（Mismatch、用户拒绝） |
| 6 | 传输错误（路径不存在、权限不足） |

---

# 5. 错误输出规范

- 错误信息输出到 **stderr**，正常输出到 **stdout**
- 人类格式：`✗ <错误摘要>\n  <可操作建议>`
- JSON 格式：`{ "error": { "code": "AUTH_FAILED", "message": "...", "hint": "..." } }`
- 不输出堆栈跟踪（除非 `--debug`）

---

# 6. 输出原则

- **人类优先**：默认输出对终端用户友好（对齐、颜色、图标）
- **机器可读**：`--json` 输出稳定结构化 JSON，字段名 camelCase
- **稳定契约**：JSON 字段一经发布不随意变更，变更需升版本
- **不冗余**：人类格式不输出多余字段，JSON 格式可包含完整信息