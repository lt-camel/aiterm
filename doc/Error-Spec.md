# aiterm 错误规范

**版本：v0.1**

定义 `aiterm` 的错误类型分类、错误码体系与消息规范。对应架构文档 [§20](Architecture.md) Known Hosts 等场景。

---

# 1. 错误基类

所有业务错误继承自 `AitermError`：

```typescript
abstract class AitermError extends Error {
    abstract readonly code: string;
    abstract readonly hint: string;
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}
```

- `code`：机器可读错误码（大写蛇形，如 `AUTH_FAILED`）
- `message`：人类可读错误描述
- `hint`：可操作建议（如何修复）

---

# 2. 错误分类

| 错误类 | 错误码前缀 | 场景 | 退出码 |
|--------|-----------|------|--------|
| `ConfigError` | `CONFIG_*` | SSH Config 解析失败、Target 未知 | 2 |
| `ConnectionError` | `CONN_*` | 网络超时、连接拒绝 | 3 |
| `AuthError` | `AUTH_*` | 私钥无效、认证被拒 | 4 |
| `KnownHostsError` | `KNOWN_HOSTS_*` | Mismatch、用户拒绝 | 5 |
| `TransferError` | `TRANSFER_*` | 路径不存在、权限不足 | 6 |
| `ExecError` | `EXEC_*` | 命令执行失败、超时 | 1 |
| `InternalError` | `INTERNAL_*` | 未预期错误 | 1 |

---

# 3. 错误码清单

```text
CONFIG_PARSE_ERROR       SSH Config 语法错误
CONFIG_NOT_FOUND         SSH Config 文件不存在
CONFIG_HOST_UNKNOWN      Target 未在配置中找到
CONFIG_HOST_INCOMPLETE   Host 块缺少必要字段（如 HostName）

CONN_TIMEOUT             连接超时
CONN_REFUSED             连接被拒绝
CONN_NETWORK             网络不可达

AUTH_KEY_INVALID         私钥格式无效或损坏
AUTH_KEY_NOT_FOUND       私钥文件不存在
AUTH_REJECTED            服务器拒绝认证

KNOWN_HOSTS_MISMATCH     主机密钥不匹配（潜在中间人）
KNOWN_HOSTS_UNKNOWN      首次连接，主机密钥未记录
KNOWN_HOSTS_USER_REJECT  用户拒绝连接未知主机

TRANSFER_LOCAL_NOT_FOUND   本地路径不存在
TRANSFER_REMOTE_NOT_FOUND  远程路径不存在
TRANSFER_PERMISSION        权限不足

EXEC_TIMEOUT             命令执行超时
EXEC_NON_ZERO_EXIT        命令退出码非零（可选抛出）

INTERNAL_UNEXPECTED      未预期错误
```

---

# 4. 错误消息规范

## 4.1 人类格式（默认）

```text
✗ 认证失败：私钥文件不存在
  提示：检查 SSH Config 中 IdentityFile 路径是否正确
```

- 第一行：`✗ <错误摘要>`
- 第二行起：`  提示：<可操作建议>`
- 不输出堆栈（除非 `--debug`）

## 4.2 JSON 格式（`--json`）

```json
{
  "error": {
    "code": "AUTH_KEY_NOT_FOUND",
    "message": "私钥文件不存在",
    "hint": "检查 SSH Config 中 IdentityFile 路径是否正确"
  }
}
```

字段稳定，字段名 camelCase，不随意变更。

---

# 5. 错误传播

```text
底层模块 throw AitermError 子类
    ↓
Runtime 不 catch（透传）
    ↓
CLI 入口 catch
    ↓
按 --json 决定输出格式 + 设置退出码
```

- 底层模块抛具体错误类型，不抛裸 `Error`
- Runtime 层只做编排，不吞错误
- CLI 入口是唯一 catch 并格式化的地方
- 严禁 `catch { }` 静默吞错

---

# 6. 安全约束

- 错误消息**不输出**私钥内容、密码、passphrase
- Known Hosts Mismatch 错误**不输出**实际主机密钥全文，只输出指纹
- 详见 [Security-Guidelines.md](Security-Guidelines.md)