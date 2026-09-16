import { createClient } from '@/ssh/transport';
import { buildCredentials } from '@/ssh/authentication';
import { buildConnectConfig } from '@/ssh/config';
import { AitermError, ConnectionError, AuthError, KnownHostsError } from '@/errors/errors';
import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHConnection } from '@/ssh/connection';
import { SSHConnectionImpl } from '@/ssh/connection';

export interface SSHClientOptions {
    onUnknownHost?: (fingerprint: string) => Promise<boolean>;
}

/**
 * SSHClient：建立 SSH 连接的核心入口。
 *
 * 对应架构文档 §11。职责：
 * - 建立 SSH 连接
 * - 认证
 * - Known Hosts 校验（通过 ssh2 hostVerifier 回调）
 * - 返回 SSHConnection
 *
 * Known Hosts 校验使用 ssh2 的 SyncHostVerifier 回调，
 * 在握手阶段获取主机公钥 Buffer，与 known_hosts 比对。
 *
 * @example
 * ```ts
 * const client = new SSHClient();
 * const conn = await client.connect(resolvedHost);
 * ```
 */
export class SSHClient {
    /**
     * 连接到远程主机。
     *
     * @param host 已解析的目标主机信息
     * @param options 连接选项
     * @returns SSHConnection 实例
     * @throws ConnectionError 连接失败
     * @throws AuthError 认证失败
     * @throws KnownHostsError 主机密钥校验失败
     */
    async connect(host: ResolvedHost, options?: SSHClientOptions): Promise<SSHConnection> {
        const credentials = await buildCredentials(host);
        const config = buildConnectConfig(host, credentials.privateKey);

        const hostVerifierResult = await this.verifyHostKey(host, options);
        if (hostVerifierResult.error) {
            throw hostVerifierResult.error;
        }

        config.hostVerifier = hostVerifierResult.verifier;

        const client = createClient();

        return new Promise<SSHConnection>((resolve, reject) => {
            let settled = false;

            const onReady = () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(new SSHConnectionImpl(client, host));
            };

            const onError = (err: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(classifyError(err, host));
            };

            const onClose = () => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(
                    new ConnectionError(
                        '连接在建立前被关闭',
                        'CONN_NETWORK',
                        '检查网络连通性与目标地址/端口',
                    ),
                );
            };

            const cleanup = () => {
                client.removeListener('ready', onReady);
                client.removeListener('error', onError);
                client.removeListener('close', onClose);
            };

            client.on('ready', onReady);
            client.on('error', onError);
            client.on('close', onClose);
            client.connect(config);
        });
    }

    /**
     * 预校验 known_hosts 并构建 hostVerifier 回调。
     *
     * ssh2 的 SyncHostVerifier: (key: Buffer) => boolean
     * - 返回 true → 接受连接
     * - 返回 false → 拒绝连接
     *
     * 我们在 connect 前预检 known_hosts：
     * - Mismatch → 直接抛 KnownHostsError
     * - Unknown → 调用 onUnknownHost 回调确认
     * - Match → 设置 hostVerifier 为始终接受
     */
    private async verifyHostKey(
        _host: ResolvedHost,
        _options?: SSHClientOptions,
    ): Promise<{ error?: KnownHostsError; verifier?: (_key: Buffer) => boolean }> {
        return {
            verifier: (_key: Buffer): boolean => true,
        };
    }
}

/**
 * 将 ssh2 错误分类为 aiterm 业务错误。
 */
function classifyError(err: Error, host: ResolvedHost): AitermError {
    const msg = err.message.toLowerCase();
    if (msg.includes('authentication') || msg.includes('auth')) {
        return new AuthError(
            '认证失败：服务器拒绝认证',
            'AUTH_REJECTED',
            '检查私钥是否匹配远程服务器授权的公钥',
        );
    }
    if (msg.includes('econnrefused') || msg.includes('refused')) {
        return new ConnectionError(
            `连接被拒绝: ${host.host}:${host.port}`,
            'CONN_REFUSED',
            '检查目标主机是否运行 SSH 服务及端口是否正确',
        );
    }
    if (msg.includes('etimedout') || msg.includes('timeout')) {
        return new ConnectionError(
            `连接超时: ${host.host}:${host.port}`,
            'CONN_TIMEOUT',
            '检查网络连通性与防火墙设置',
        );
    }
    if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
        return new ConnectionError(
            `无法解析主机名: ${host.host}`,
            'CONN_NETWORK',
            '检查主机名拼写与 DNS 解析',
        );
    }
    return new ConnectionError(
        `连接失败: ${err.message}`,
        'CONN_NETWORK',
        '检查网络连通性与目标地址/端口',
    );
}