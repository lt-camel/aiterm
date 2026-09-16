# aiterm 代码规范

**版本：v0.1**

本规范约束 `aiterm` 项目的代码风格与组织方式，确保跨会话、跨协作者的一致性。

---

# 1. 命名约定

| 对象 | 约定 | 示例 |
|------|------|------|
| 文件 | kebab-case | `ssh-config/parser.ts` |
| 类 / 接口 | PascalCase | `SSHClient`、`ResolvedHost` |
| 函数 / 变量 | camelCase | `resolveTarget`、`hostName` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_SSH_PORT` |
| 类型别名 | PascalCase | `ExecResult` |
| 枚举成员 | PascalCase | `KnownHostState.Match` |

接口命名不使用 `I` 前缀（如用 `SSHClient` 而非 `ISSHClient`）。

---

# 2. 文件组织

- 每个文件只导出一个主要类/接口/函数
- 文件名与主要导出一致（`parser.ts` 导出 `Parser` 或 `parse`）
- 模块入口使用 `index.ts` 做 barrel 导出，但仅导出公开 API
- 测试文件与源文件同构：`src/ssh-config/parser.ts` → `tests/ssh-config/parser.test.ts`

---

# 3. 模块依赖

严格遵循架构文档 [§33–§34](Architecture.md)：

```text
CLI → Runtime → SSH Config / SSH → Platform
```

- 核心层禁止 import CLI
- 禁止任何模块直接 import `ssh2`，必须经 `src/ssh/transport.ts`
- `ssh-config` 不依赖 `ssh`
- 循环依赖禁止，必要时提取共享类型到 `model.ts`

---

# 4. import 规则

- 使用 ESM `import`，禁用 `require`
- import 顺序：Node 内置 → 第三方 → 项目内部（按组空行分隔）
- 项目内部 import 使用路径别名 `@/`（指向 `src/`）
- 禁止 `export *`，显式导出

```typescript
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';

import { ResolvedHost } from '@/ssh-config/model';
import { AitermError } from '@/errors/errors';
```

---

# 5. 错误处理

- 所有业务错误使用 `src/errors/errors.ts` 中的 `AitermError` 子类
- 不抛裸字符串或原生 `Error`
- 错误须包含：错误码、人类可读消息、可操作建议
- 边界处（CLI 入口）catch 所有错误，转换为友好输出 + 非零退出码
- 详见 [Error-Spec.md](Error-Spec.md)

---

# 6. 注释策略

- **注释必须齐全**，应当介绍当前文件功能、示例、
- 方法必须有注释，介绍参数、返回值、异常等
- 其余情况适当添加注释：
  - 解决了非显而易见的 bug（注明原因）
  - 涉及安全敏感逻辑（如 known_hosts 校验）
  - 引用外部协议规范（标注 RFC/章节）
- 测试代码必须有注释，介绍测试场景、预期结果、边界条件等
- 注释用中文，与文档语言一致
- 禁止写"what"型注释（如 `// 循环遍历`），只写"why"

---

# 7. 异步与并发

- 使用 `async/await`，禁用裸 `.then().catch()` 链
- 所有 I/O 操作使用 Promise API（`fs/promises` 而非 `fs`）
- 长时操作（连接、传输）须支持取消（AbortSignal）
- 资源（连接、会话）须实现 `close()` 并在 `finally` 中调用

---

# 8. 类型安全

- `tsconfig` 开启 `strict: true`
- 禁用 `any`，必要时用 `unknown` + 类型守卫
- 禁用 `@ts-ignore`，必要时用 `@ts-expect-error` 并注明原因
- 公共 API 必须显式标注返回类型
- 优先使用 `interface` 定义对象形状，`type` 用于联合/工具类型

---

# 9. 日志

- 使用统一的 logger 模块（Phase 0 引入）
- 日志级别：`debug` / `info` / `warn` / `error`
- 禁止 `console.log` 直接输出（CLI renderer 除外）
- 禁止输出敏感信息：私钥内容、密码、passphrase
- 详见 [Security-Guidelines.md](Security-Guidelines.md)

---

# 10. 测试要求

- 纯逻辑模块单元测试覆盖率 ≥ 80%
- 每个 `parser` / `resolver` 类必须有边界用例
- 测试文件使用 `*.test.ts` 后缀
- 测试不依赖真实网络，SSH 相关测试用 mock 或测试容器
- 详见 [Testing-Strategy.md](Testing-Strategy.md)