# aiterm 测试策略

**版本：v0.1**

定义 `aiterm` 项目的测试分层、环境、fixture 与覆盖率目标。

---

# 1. 测试分层

| 层级 | 范围 | 工具 | 目标 |
|------|------|------|------|
| 单元测试 | 纯函数/类（parser、resolver、model） | vitest | 覆盖率 ≥ 80% |
| 集成测试 | 模块组合（runtime + ssh-config） | vitest | 关键链路覆盖 |
| SSH 集成测试 | 真实 SSH 连接（client、connection、exec、transfer） | vitest + 测试容器 | 核心场景覆盖 |
| CLI 端到端 | 命令行入口到输出 | vitest + execa | 每命令至少 1 用例 |
| 手动测试 | 交互式 PTY、resize、signal | 人工 | 发布前执行 |

---

# 2. 测试文件组织

```text
tests/
├── ssh-config/
│   ├── parser.test.ts
│   ├── resolver.test.ts
│   └── loader.test.ts
├── ssh/
│   ├── client.test.ts
│   ├── connection.test.ts
│   └── known-hosts.test.ts
├── runtime/
│   └── runtime.test.ts
├── cli/
│   ├── host.test.ts
│   └── exec.test.ts
└── fixtures/
    ├── ssh-config/
    │   ├── basic.conf
    │   └── multi-host.conf
    └── keys/
        └── (测试用密钥，git 忽略)
```

---

# 3. 测试 SSH 服务器

SSH 集成测试需要真实 SSH 服务，使用 Docker 容器提供：

```yaml
# docker-compose.test.yml（Phase 2 引入）
services:
  sshd:
    image: linuxserver/openssh-server
    environment:
      - USER_NAME=testuser
      - PUBLIC_KEY=<测试公钥>
    ports:
      - "2222:2222"
```

要求：
- 测试容器仅用于测试，密钥为测试专用、无敏感价值
- 测试用密钥放在 `tests/fixtures/keys/`，加入 `.gitignore`
- CI 中自动启动容器，本地可选

---

# 4. Mock 策略

| 对象 | 策略 |
|------|------|
| `ssh2` 底层 | 经 Transport Adapter 接口 mock，不直接 mock ssh2 |
| 文件系统 | 使用 `memfs` 或临时目录，不读真实 `~/.ssh/config` |
| 网络 | 单元测试不触网络，集成测试用容器 |
| 时间 | 使用 `vi.useFakeTimers()` 测试超时 |

---

# 5. Fixture 管理

- SSH Config 样本放 `tests/fixtures/ssh-config/`
- 每个样本覆盖一种场景：基础、多 Host、多 IdentityFile、缺字段、语法错误
- 测试密钥生成脚本放 `tests/fixtures/keys/generate.sh`，CI 自动生成

---

# 6. 覆盖率目标

| 模块 | 目标 |
|------|------|
| `ssh-config/` | ≥ 90%（纯逻辑，易测） |
| `errors/` | ≥ 80% |
| `ssh/` | ≥ 60%（依赖容器，适当放宽） |
| `cli/` | ≥ 50%（端到端覆盖关键路径） |
| `runtime/` | ≥ 70% |

覆盖率报告由 `vitest --coverage` 生成，CI 中检查阈值。

---

# 7. 测试命名与结构

```typescript
describe('Parser', () => {
  describe('parse', () => {
    it('解析单 Host 块', () => { ... });
    it('解析多 Host 块', () => { ... });
    it('解析 IdentityFile 多值', () => { ... });
    it('遇到语法错误抛出 ConfigError', () => { ... });
  });
});
```

- `describe` 用类名/模块名
- `it` 用中文描述行为，"解析 X"、"遇到 Y 抛出 Z"
- 一个 `it` 只测一个行为

---

# 8. 测试运行

```bash
npm test                 # 运行全部
npm run test:watch       # 监听模式
npm run test:coverage    # 生成覆盖率报告
npm run test:ssh         # 仅 SSH 集成测试（需容器）
```