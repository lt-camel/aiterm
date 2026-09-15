# aiterm 环境搭建

**版本：v0.1**

本地开发环境搭建指南。

---

# 1. 前置要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | LTS (≥ 20) | 推荐用 nvm 管理版本 |
| npm | ≥ 10 | 随 Node 安装 |
| Git | 任意 | 版本控制 |
| Docker | 可选 | SSH 集成测试用（Phase 2+） |

Windows 额外需要：
- Visual Studio Build Tools（`ssh2` / `node-pty` 原生模块编译）
- 或使用 `windows-build-tools`

---

# 2. 初始化步骤

```bash
# 1. 克隆仓库
git clone <repo-url>
cd aiterm

# 2. 安装依赖
npm install

# 3. 验证环境
npm run typecheck
npm run lint
npm run build
npm test
```

四个命令全部通过即环境就绪。

---

# 3. 测试 SSH 服务器（Phase 2+）

SSH 集成测试需要真实 SSH 服务：

```bash
# 启动测试容器
docker compose -f tests/docker-compose.test.yml up -d

# 生成测试密钥
bash tests/fixtures/keys/generate.sh

# 运行 SSH 集成测试
npm run test:ssh
```

测试密钥仅用于测试，无敏感价值，已加入 `.gitignore`。

---

# 4. 推荐的测试 SSH Config

开发时可在 `~/.ssh/config` 添加测试 Host：

```sshconfig
Host aiterm-test
    HostName 127.0.0.1
    Port 2222
    User testuser
    IdentityFile ~/.ssh/aiterm_test_key
```

---

# 5. 常见问题

## 5.1 ssh2 安装失败（Windows）

安装 Visual Studio Build Tools，或执行：
```bash
npm install --global windows-build-tools
```

## 5.2 node-pty 编译失败

确保已安装 Python 3 与 Build Tools，参考 `node-pty` 文档。

## 5.3 测试容器连接失败

检查端口 2222 未被占用：
```bash
docker compose -f tests/docker-compose.test.yml logs
```