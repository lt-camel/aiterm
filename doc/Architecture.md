# aiterm — AI-Native Remote Terminal 基础架构设计

**版本：v0.2**

---

# 1. 项目定位

`aiterm` 是一个面向 AI Agent 的本地远程终端基础设施。

它本质上是：

> **一个本地运行的 SSH Client / Remote Terminal Runtime。**

它允许：

* 人通过 CLI 连接远程服务器
* AI Agent 通过 Skill 调用 `aiterm`
* 执行任意远程 Shell 命令
* 与远程 Shell 建立交互式会话
* 上传 / 下载文件
* 管理 SSH Host 配置
* 在未来由桌面客户端提供图形化操作

`aiterm` 本身：

* 不是网络服务
* 不提供 HTTP API Server
* 不使用 MCP
* 不需要远程安装 Agent
* 不负责理解 Docker / Kubernetes / Linux 等具体领域
* 不负责判断用户应该执行什么命令

其核心职责只有：

> **连接远程机器，并可靠地操作远程 Shell。**

---

# 2. 核心设计原则

## 2.1 SSH 是连接层

`aiterm` 首先解决的是：

> **How to connect?**

即：

```text
如何连接远程服务器？
```

例如：

```sshconfig
Host production
    HostName 10.0.0.20
    User deploy
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

最终解析成：

```text
Target
  ↓
ResolvedHost
  ↓
SSH Connection
```

---

# 2.2 Shell Command 是执行载荷

连接以后：

```bash
ls
docker ps
kubectl get pods
systemctl restart nginx
python app.py
npm run build
uname -a
```

对 `aiterm` 来说全部都是：

```text
Command Payload
```

例如：

```text
"docker ps"
```

不应该被设计成：

```text
DockerCommand
```

也不应该存在：

```text
LinuxProvider
DockerProvider
KubernetesProvider
PythonProvider
```

---

# 2.3 aiterm 不理解远程软件

这是整个架构最重要的原则之一。

例如：

```bash
docker ps
```

`aiterm` 不需要知道 Docker 是什么。

同样：

```bash
kubectl get pods
```

`aiterm` 不需要知道 Kubernetes 是什么。

甚至：

```bash
echo hello
```

和：

```bash
docker exec nginx bash
```

对于 `aiterm` 来说，本质上都是：

```text
远程执行一个字符串
```

因此：

```text
aiterm
   │
   ├── SSH
   │
   ├── Shell
   │
   ├── Command
   │
   ├── Stream
   │
   └── File Transfer
```

而不是：

```text
aiterm
   │
   ├── Linux
   ├── Docker
   ├── Kubernetes
   ├── Python
   └── Node.js
```

---

# 3. 系统整体架构

整体结构：

```text
                    ┌─────────────────────┐
                    │      AI Agent       │
                    │ Codex / Claude Code │
                    └──────────┬──────────┘
                               │
                             Skill
                               │
                               ▼
                    ┌─────────────────────┐
                    │       aiterm        │
                    │      CLI Runtime    │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
          SSH Config                    Terminal
                 │
                 ▼
           Host Resolver
                 │
                 ▼
           ResolvedHost
                 │
                 ▼
             SSH Client
                 │
        ┌────────┼────────┐
        │        │        │
        ▼        ▼        ▼
       Exec    Session   Transfer
        │        │        │
        ▼        ▼        ▼
   Remote Shell  PTY     SFTP/SCP
```

核心关系可以简化成：

```text
Target
   ↓
SSH Config
   ↓
Host Resolver
   ↓
ResolvedHost
   ↓
SSH Client
   ↓
SSH Connection
   ├── Exec
   ├── Interactive Session
   └── File Transfer
```

---

# 4. 核心领域模型

第一版本不需要大量抽象。

核心对象控制在以下范围：

```text
Target
ResolvedHost
SSHConfig
HostBlock
SSHClient
SSHConnection
SSHSession
ExecResult
KnownHosts
IdentityFile
```

---

# 5. Target

`Target` 表示用户想连接的目标。

例如：

```bash
aiterm ssh production
```

这里：

```text
Target = "production"
```

Target 本身不是服务器配置。

它只是：

> **用户提供的目标名称。**

---

# 6. SSH Config

SSH Config 是 Host 配置的主要来源。

默认路径：

Linux/macOS：

```text
~/.ssh/config
```

Windows：

```text
%USERPROFILE%\.ssh\config
```

Node.js 中：

```typescript
const sshDir = path.join(os.homedir(), ".ssh");
const configPath = path.join(sshDir, "config");
```

---

# 7. SSH Config 数据模型

例如：

```sshconfig
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

解析后：

```typescript
interface HostBlock {
    patterns: string[];
    directives: Map<string, string[]>;
}
```

例如：

```text
HostBlock
├── patterns
│   └── production
│
├── HostName
│   └── 192.168.1.100
│
├── User
│   └── root
│
├── Port
│   └── 22
│
└── IdentityFile
    └── ~/.ssh/id_ed25519
```

---

# 8. SSH Config Parser

第一阶段只支持基础配置：

```text
Host
HostName
User
Port
IdentityFile
```

例如：

```sshconfig
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

Parser：

```text
文本
 ↓
Lexer / Line Parser
 ↓
HostBlock
 ↓
SSHConfig
```

---

# 9. Host Resolver

`HostResolver` 负责：

> 将用户输入的 Target 转换成真正可以建立 SSH 连接的 `ResolvedHost`。

例如：

```text
production
```

经过：

```text
HostResolver
```

得到：

```typescript
interface ResolvedHost {
    host: string;
    port: number;
    username: string;
    identityFiles: string[];
}
```

例如：

```json
{
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "identityFiles": [
    "/home/user/.ssh/id_ed25519"
  ]
}
```

---

# 10. Target 与 ResolvedHost 必须分离

这是一个重要设计。

不要：

```typescript
connect("production")
```

然后在 SSH Client 内部自己解析配置。

应该：

```text
Target
  ↓
HostResolver
  ↓
ResolvedHost
  ↓
SSHClient
```

原因是：

SSH Client 不应该知道：

```text
~/.ssh/config
Host production
```

SSH Client 只应该知道：

```text
host
port
username
authentication
```

这样职责更加清晰。

---

# 11. SSH Client

SSH Client 是核心基础设施。

职责：

```text
建立 SSH 连接
认证
创建 SSH Channel
执行命令
创建交互 Session
关闭连接
```

例如：

```typescript
interface SSHClient {
    connect(host: ResolvedHost): Promise<SSHConnection>;
}
```

---

# 12. SSH Connection

连接成功之后：

```typescript
interface SSHConnection {
    exec(command: string): Promise<ExecResult>;

    createSession(options?: SessionOptions): Promise<SSHSession>;

    close(): Promise<void>;
}
```

核心能力只有三类：

```text
Exec
Session
Transfer
```

未来可以增加：

```text
PortForward
```

但第一阶段不实现。

---

# 13. Exec

`Exec` 用于一次性执行命令。

例如：

```bash
aiterm exec production -- uname -a
```

内部：

```text
Target
 ↓
ResolvedHost
 ↓
SSHConnection
 ↓
exec("uname -a")
 ↓
Remote SSH Exec Channel
```

返回：

```typescript
interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
```

例如：

```json
{
  "stdout": "Linux server 6.8.0 ...",
  "stderr": "",
  "exitCode": 0
}
```

---

# 14. Command 不需要复杂领域模型

第一版本不要设计：

```typescript
class Command {}
```

更不需要：

```typescript
class DockerCommand {}
class KubernetesCommand {}
class LinuxCommand {}
```

直接：

```typescript
exec(command: string)
```

即可。

例如：

```typescript
await connection.exec("docker ps");
```

或者：

```typescript
await connection.exec("kubectl get pods");
```

或者：

```typescript
await connection.exec("systemctl restart nginx");
```

对于 `aiterm` 来说没有区别。

---

# 15. 为什么仍然需要 Exec 与 Session 两种模型？

虽然用户看到的都是：

```bash
远程 Shell
```

但 SSH 层面存在区别。

## Exec

```text
SSH Connection
      │
      ▼
SSH Exec Channel
      │
      ▼
command
```

适合：

```bash
uname -a
ls
docker ps
git status
```

执行完成后 Channel 可以关闭。

---

## Interactive Session

例如：

```bash
aiterm ssh production
```

需要：

```text
SSH Connection
      │
      ▼
PTY
      │
      ▼
Remote Shell
      │
      ⇅
Local Terminal
```

它是一个持续存在的双向字节流。

例如：

```text
stdin  ───────────────► remote
stdout ◄─────────────── remote
stderr ◄─────────────── remote
```

因此：

```text
Exec
```

和：

```text
Interactive Session
```

应该保持不同的 API。

---

# 16. SSH Session

定义：

```typescript
interface SSHSession {
    write(data: Uint8Array): Promise<void>;

    onData(callback: (data: Uint8Array) => void): void;

    resize(cols: number, rows: number): Promise<void>;

    close(): Promise<void>;
}
```

CLI 层负责：

```text
stdin
stdout
terminal resize
signals
```

SSH Core 不应该直接控制 CLI UI。

---

# 17. Terminal 层

Terminal 是 CLI 对 SSH Session 的适配。

结构：

```text
Terminal
   │
   ├── stdin
   ├── stdout
   ├── stderr
   ├── resize
   └── signal
        │
        ▼
   SSHSession
```

例如：

```bash
aiterm ssh production
```

最终：

```text
Local Terminal
      ⇅
Terminal Adapter
      ⇅
SSHSession
      ⇅
Remote PTY
      ⇅
Remote Shell
```

---

# 18. File Transfer

文件传输也是 SSH 基础能力。

未来支持：

```text
Upload
Download
```

例如：

```bash
aiterm upload production ./app.exe /tmp/app.exe
```

内部：

```text
Local File
    │
    ▼
Transfer API
    │
    ▼
SSH Connection
    │
    ▼
SFTP
    │
    ▼
Remote File
```

或者：

```bash
aiterm download production /var/log/app.log ./app.log
```

---

# 19. Transfer 不需要理解文件类型

例如：

```text
app.exe
app.tar.gz
model.bin
image.png
database.sql
```

对 `aiterm` 来说全部只是：

```text
File
```

不需要：

```text
WindowsFile
LinuxFile
DockerFile
PythonFile
```

---

# 20. Known Hosts

SSH 安全必须保留。

默认：

```text
~/.ssh/known_hosts
```

连接时：

```text
Server Host Key
      │
      ▼
Known Hosts
      │
 ┌────┼────┐
 ▼    ▼    ▼
Match Unknown Mismatch
```

状态：

### Match

继续连接。

### Unknown

第一次连接。

未来 CLI 可以：

```text
The authenticity of host ... can't be established.
Continue? [y/N]
```

### Mismatch

默认拒绝连接。

不能为了方便直接：

```text
StrictHostKeyChecking=no
```

---

# 21. Authentication

第一阶段优先：

```text
IdentityFile
```

例如：

```sshconfig
IdentityFile ~/.ssh/id_ed25519
```

认证流程：

```text
ResolvedHost
      │
      ▼
IdentityFile
      │
      ▼
Private Key
      │
      ▼
SSH Authentication
```

未来支持：

```text
SSH Agent
Password
Passphrase
Hardware Security Key
```

但不进入第一阶段核心实现。

---

# 22. Runtime

Runtime 不是一个“远程 Provider”。

它只是：

> **应用层的编排入口。**

例如：

```typescript
class Runtime {
    sshConfig: SSHConfig;
    resolver: HostResolver;
    sshClient: SSHClient;
}
```

执行：

```text
CLI
 ↓
Runtime
 ↓
Resolver
 ↓
SSH Client
```

Runtime 不负责理解：

```text
Docker
Kubernetes
Linux
Windows
Python
Node.js
```

---

# 23. 为什么不需要 RemoteProvider

旧架构可能出现：

```text
RemoteProvider
├── LinuxProvider
├── DockerProvider
├── KubernetesProvider
└── ...
```

现在全部删除。

原因：

如果用户执行：

```bash
docker ps
```

实际流程就是：

```text
aiterm
 ↓
SSH
 ↓
Remote Shell
 ↓
docker ps
```

`docker ps` 的解释权属于远程服务器。

不是 `aiterm`。

因此：

```text
RemoteProvider ❌
```

应该变成：

```text
SSH Client
   ↓
Remote Shell
```

这是更加简单、通用和可扩展的架构。

---

# 24. 完整调用链

## 24.1 查看 Host

```bash
aiterm host list
```

流程：

```text
CLI
 ↓
Runtime
 ↓
SSH Config Loader
 ↓
SSH Config Parser
 ↓
Host Blocks
 ↓
CLI Renderer
```

---

# 25. 查看 Host 详情

```bash
aiterm host show production
```

流程：

```text
production
 ↓
HostResolver
 ↓
ResolvedHost
 ↓
Renderer
```

输出：

```text
Target: production

Host:     192.168.1.100
Port:     22
User:     root
Identity: ~/.ssh/id_ed25519
```

---

# 26. SSH 登录

```bash
aiterm ssh production
```

完整流程：

```text
CLI
 │
 ▼
Target("production")
 │
 ▼
HostResolver
 │
 ▼
ResolvedHost
 │
 ▼
SSHClient.connect()
 │
 ▼
SSHConnection
 │
 ▼
SSHSession
 │
 ▼
PTY
 │
 ▼
Remote Shell
```

---

# 27. 执行命令

```bash
aiterm exec production -- docker ps
```

流程：

```text
CLI
 │
 ▼
Target
 │
 ▼
HostResolver
 │
 ▼
ResolvedHost
 │
 ▼
SSHClient
 │
 ▼
SSHConnection
 │
 ▼
exec("docker ps")
 │
 ▼
Remote Server
 │
 ▼
Remote Shell / Command Execution
```

---

# 28. AI Agent 调用

未来 Codex / Claude Code 不应该直接操作 SSH 协议。

而是：

```text
AI Agent
    │
    ▼
aiterm Skill
    │
    ▼
aiterm CLI
    │
    ▼
Runtime
    │
    ▼
SSH
```

例如 AI 需要上传文件：

```text
AI Agent
   │
   │ aiterm upload
   ▼
aiterm
   │
   ▼
SSH/SFTP
   │
   ▼
Remote Server
```

AI Agent 不需要知道：

```text
SSH private key
SSH protocol
SFTP protocol
known_hosts
```

这些全部由 `aiterm` 负责。

---

# 29. Skill 层

Skill 不属于 SSH Core。

未来可以：

```text
skills/
└── aiterm/
    ├── SKILL.md
    ├── commands.md
    └── examples/
```

Skill 主要描述：

```text
什么时候使用 aiterm
如何查找 Host
如何执行远程命令
如何上传文件
如何下载文件
如何处理错误
```

例如：

```text
AI Agent
   │
   ▼
aiterm Skill
   │
   ▼
CLI
```

这样可以让：

```text
Codex
Claude Code
其他 AI Coding Agent
```

都使用同一个基础设施。

---

# 30. CLI 设计

第一阶段 CLI：

```bash
aiterm host list
```

列出 SSH Hosts。

```bash
aiterm host show production
```

查看解析结果。

```bash
aiterm ssh production
```

建立交互式 SSH Session。

```bash
aiterm exec production -- uname -a
```

执行远程命令。

```bash
aiterm exec production -- docker ps
```

执行任意命令。

```bash
aiterm config path
```

显示 SSH Config 路径。

```bash
aiterm config check
```

检查 SSH Config。

---

# 31. CLI 命令结构

整体：

```text
aiterm
├── host
│   ├── list
│   └── show
│
├── ssh
│
├── exec
│
├── upload
│
├── download
│
└── config
    ├── path
    └── check
```

未来：

```text
aiterm
├── forward
├── tunnel
├── session
└── skill
```

---

# 32. 项目目录结构

推荐：

```text
aiterm/
│
├── src/
│   │
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── ssh.ts
│   │   │   ├── exec.ts
│   │   │   ├── upload.ts
│   │   │   ├── download.ts
│   │   │   ├── host.ts
│   │   │   └── config.ts
│   │   │
│   │   └── renderer/
│   │
│   ├── runtime/
│   │   └── runtime.ts
│   │
│   ├── ssh-config/
│   │   ├── parser.ts
│   │   ├── resolver.ts
│   │   ├── loader.ts
│   │   ├── model.ts
│   │   └── path.ts
│   │
│   ├── ssh/
│   │   ├── client.ts
│   │   ├── connection.ts
│   │   ├── session.ts
│   │   ├── exec.ts
│   │   ├── transfer.ts
│   │   ├── authentication.ts
│   │   └── known-hosts.ts
│   │
│   ├── terminal/
│   │   ├── terminal.ts
│   │   ├── pty.ts
│   │   └── resize.ts
│   │
│   ├── platform/
│   │   ├── paths.ts
│   │   └── windows.ts
│   │
│   ├── errors/
│   │   └── errors.ts
│   │
│   └── index.ts
│
├── tests/
│   ├── ssh-config/
│   ├── ssh/
│   ├── runtime/
│   └── cli/
│
├── docs/
│   ├── architecture.md
│   ├── cli.md
│   └── skill.md
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# 33. 模块依赖关系

必须保持：

```text
CLI
 ↓
Runtime
 ↓
SSH Config / SSH
 ↓
Platform
```

而不能：

```text
SSH Core
 ↓
CLI
```

也不能：

```text
SSH Config
 ↓
CLI
```

核心层不能反向依赖 UI。

---

# 34. 推荐依赖方向

```text
┌─────────────────────┐
│        CLI          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      Runtime        │
└───────┬───────┬─────┘
        │       │
        ▼       ▼
┌───────────┐ ┌────────────┐
│SSH Config │ │    SSH     │
└───────────┘ └─────┬──────┘
                    │
                    ▼
             SSH Transport
```

其中：

```text
SSH Config
```

不依赖：

```text
SSH Client
```

---

# 35. SSH Transport Adapter

虽然不需要 `RemoteProvider`，但 SSH Client 底层仍然可以保留一个非常薄的 Transport Adapter。

例如：

```text
SSHClient
    │
    ▼
SSHTransport
    │
    ▼
Node SSH Library
```

目的不是为了增加业务抽象。

而是为了隔离第三方 SSH 实现。

未来如果：

```text
Node SSH Library
```

需要替换成：

```text
Rust SSH Core
```

或者：

```text
Go SSH Core
```

上层 API 不需要大规模修改。

---

# 36. 不应该过度抽象

第一版本不要设计：

```text
RemoteProvider
CommandProvider
ExecutionProvider
EnvironmentProvider
LinuxAdapter
DockerAdapter
KubernetesAdapter
```

这些都会导致架构变重。

当前真正需要的是：

```text
Host
SSH
Session
Exec
Transfer
```

---

# 37. 核心接口

第一版本可以控制在：

```typescript
interface HostResolver {
    resolve(target: string): Promise<ResolvedHost>;
}
```

```typescript
interface SSHClient {
    connect(host: ResolvedHost): Promise<SSHConnection>;
}
```

```typescript
interface SSHConnection {
    exec(command: string): Promise<ExecResult>;

    createSession(
        options?: SessionOptions
    ): Promise<SSHSession>;

    close(): Promise<void>;
}
```

```typescript
interface SSHSession {
    write(data: Uint8Array): Promise<void>;

    onData(
        callback: (data: Uint8Array) => void
    ): void;

    resize(
        cols: number,
        rows: number
    ): Promise<void>;

    close(): Promise<void>;
}
```

---

# 38. 第一阶段实现范围

第一阶段不要一次实现所有功能。

建议：

## Phase 1：SSH Config

实现：

```text
~/.ssh/config
```

读取：

```text
Host
HostName
User
Port
IdentityFile
```

以及：

```bash
aiterm config path
aiterm config check
aiterm host list
aiterm host show production
```

---

# 39. Phase 2：SSH Connection

实现：

```bash
aiterm ssh production
```

支持：

```text
SSH connection
Private Key
Known Hosts
PTY
Interactive Shell
```

---

# 40. Phase 3：Exec

实现：

```bash
aiterm exec production -- uname -a
```

支持：

```text
stdout
stderr
exit code
```

---

# 41. Phase 4：Transfer

增加：

```bash
aiterm upload
aiterm download
```

底层：

```text
SFTP
```

---

# 42. Phase 5：Skill

增加：

```text
aiterm Skill
```

让：

```text
Codex
Claude Code
其他 AI Agent
```

可以使用。

---

# 43. Phase 6：Desktop Client

未来：

```text
aiterm Core
      │
      ├── CLI
      │
      ├── AI Skill
      │
      └── Desktop Client
```

Desktop Client 可以提供：

```text
Host 管理
SSH Terminal
文件上传
文件下载
会话管理
AI Agent
```

但底层仍然使用相同的 SSH Core。

---

# 44. 最终产品结构

最终可以形成：

```text
                 ┌─────────────────┐
                 │    AI Agent     │
                 │ Codex / Claude  │
                 └────────┬────────┘
                          │
                       Skill
                          │
                          ▼
┌──────────────┐   ┌──────────────┐
│ Desktop App  │──▶│ aiterm Core  │
└──────────────┘   └──────┬───────┘
                          │
                 ┌────────┼────────┐
                 │        │        │
                 ▼        ▼        ▼
                SSH      Exec    Transfer
                 │        │        │
                 └────────┼────────┘
                          ▼
                    Remote Server
                          │
                          ▼
                    Remote Shell
```

---

# 45. 最重要的边界

`aiterm` 的边界应该明确：

## aiterm 负责

```text
SSH
Host
Authentication
Known Hosts
PTY
Remote Session
Remote Command Transport
File Transfer
Terminal Stream
```

## aiterm 不负责

```text
Docker
Kubernetes
Linux
Python
Node.js
Nginx
PostgreSQL
Git
Systemd
```

这些属于远程服务器。

---

# 46. 一句话定义

可以把 `aiterm` 定义为：

> **一个本地、AI-native 的 SSH Remote Terminal Runtime，为人类和 AI Agent 提供统一的远程服务器连接、Shell 执行、交互会话和文件传输能力。**

它不试图理解远程服务器运行什么软件。

它只负责：

```text
Connect
   ↓
Operate
   ↓
Stream
   ↓
Transfer
```

---

# 47. 最终核心架构

最终将架构收敛为：

```text
                         AI Agent
                    Codex / Claude Code
                           │
                         Skill
                           │
                           ▼
                    ┌──────────────┐
                    │     CLI      │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Runtime    │
                    └──────┬───────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
        ┌──────────────┐      ┌──────────────┐
        │ SSH Config   │      │ SSH Client   │
        └──────┬───────┘      └──────┬───────┘
               │                     │
               ▼                     ▼
        ┌──────────────┐      ┌──────────────┐
        │Host Resolver │─────▶│SSH Connection│
        └──────────────┘      └──────┬───────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
                  Exec            Session          Transfer
                    │                │                │
                    ▼                ▼                ▼
               Remote Cmd       Remote PTY          SFTP
                    │                │                │
                    └────────────────┼────────────────┘
                                     ▼
                              Remote Server
                                     │
                                     ▼
                                Remote Shell
```

其中最核心的一条原则是：

```text
SSH = 怎么连接远程机器

Shell Command = 连接以后让远程机器做什么
```

而：

```text
Docker
Kubernetes
Linux
Python
Node
Git
Nginx
```

全部属于第二类。

因此，它们**不应该成为 aiterm 的 Provider、Adapter 或领域模型**。

这使 `aiterm` 保持非常小的核心，同时天然具备很强的通用性。
