import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { AuthError } from '@/errors/errors';
import type { ResolvedHost } from '@/ssh-config/model';

/**
 * IdentityFile 私钥认证模块。
 *
 * 对应架构文档 §21 与 Security-Guidelines §1/§3。
 * 第一阶段仅支持 IdentityFile 认证。
 *
 * 安全约束：
 * - 私钥文件只读，读取后不持久化到内存以外
 * - 禁止在日志/错误中包含私钥内容
 * - 认证失败错误不泄露具体原因细节
 */

export interface AuthCredentials {
    username: string;
    privateKey: Buffer;
}

/**
 * 加载私钥文件内容。
 *
 * @param identityFiles 私钥路径列表（已展开 ~）
 * @returns 第一个成功读取的私钥 Buffer
 * @throws AuthError 所有私钥文件均无法读取时
 */
export async function loadPrivateKey(identityFiles: string[]): Promise<Buffer> {
    if (identityFiles.length === 0) {
        throw new AuthError(
            '未配置 IdentityFile，无法认证',
            'AUTH_KEY_NOT_FOUND',
            '在 SSH Config 中添加 IdentityFile 指令',
        );
    }

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

    throw new AuthError(
        '所有 IdentityFile 均无法读取',
        'AUTH_KEY_NOT_FOUND',
        '检查私钥文件路径与权限',
    );
}

/**
 * 从 ResolvedHost 构建认证凭据。
 *
 * @param resolved 已解析的目标主机信息
 * @returns 认证凭据（用户名 + 私钥）
 * @throws AuthError 私钥加载失败时
 */
export async function buildCredentials(resolved: ResolvedHost): Promise<AuthCredentials> {
    const privateKey = await loadPrivateKey(resolved.identityFiles);
    return {
        username: resolved.username,
        privateKey,
    };
}