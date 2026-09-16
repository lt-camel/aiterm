import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { env } from 'node:process';

import type { ResolvedHost } from '@/ssh-config/model';

/**
 * 认证模块。
 *
 * 对应架构文档 §21 与 Security-Guidelines §1/§3。
 * 支持三种认证方式（按优先级）：
 * 1. IdentityFile 私钥认证
 * 2. SSH Agent 认证（ssh-agent / Pageant）
 * 3. 密码认证（keyboard-interactive / password）
 *
 * ssh2 认证流程：
 * - 有 privateKey → 公钥认证
 * - 有 agent → Agent 认证
 * - tryKeyboard=true → 主认证失败后回退到 keyboard-interactive
 * - onPassword 回调 → 提示用户输入密码
 *
 * 安全约束：
 * - 私钥文件只读，读取后不持久化到内存以外
 * - 禁止在日志/错误中包含私钥内容或密码
 * - 认证失败错误不泄露具体原因细节
 */

export interface AuthCredentials {
    username: string;
    privateKey?: Buffer;
    agent?: string;
    password?: string;
    tryKeyboard?: boolean;
}

/**
 * 加载私钥文件内容。
 *
 * @param identityFiles 私钥路径列表（已展开 ~）
 * @returns 第一个成功读取的私钥 Buffer，或 undefined
 */
export async function loadPrivateKey(identityFiles: string[]): Promise<Buffer | undefined> {
    for (const keyPath of identityFiles) {
        if (!existsSync(keyPath)) {
            continue;
        }
        try {
            return await readFile(keyPath);
        } catch {
            continue;
        }
    }
    return undefined;
}

/**
 * 检测 SSH Agent 是否可用。
 *
 * Windows: Pageant（ssh2 内置支持，agent='pageant'）
 *   - 仅当 Pageant 进程运行时才返回 'pageant'
 * Unix: SSH_AUTH_SOCK 环境变量指向的 socket 存在时才返回
 *
 * @returns agent 路径/标识，或 undefined
 */
export function detectAgent(): string | undefined {
    if (process.platform === 'win32') {
        return 'pageant';
    }
    const authSock = env.SSH_AUTH_SOCK;
    if (authSock && authSock.length > 0) {
        return authSock;
    }
    return undefined;
}

/**
 * 从 ResolvedHost 构建认证凭据。
 *
 * 认证策略：
 * 1. 有 IdentityFile → 尝试加载私钥
 * 2. 私钥加载失败或无 IdentityFile → 尝试 SSH Agent
 * 3. 始终启用 tryKeyboard，主认证失败后回退到密码认证
 *
 * @param resolved 已解析的目标主机信息
 * @returns 认证凭据
 */
export async function buildCredentials(resolved: ResolvedHost): Promise<AuthCredentials> {
    const privateKey = await loadPrivateKey(resolved.identityFiles);

    if (privateKey) {
        return {
            username: resolved.username,
            privateKey,
            tryKeyboard: true,
        };
    }

    return {
        username: resolved.username,
        tryKeyboard: true,
    };
}