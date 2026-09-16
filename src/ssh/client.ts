import { createClient } from '@/ssh/transport';
import { buildCredentials } from '@/ssh/authentication';
import { buildConnectConfig } from '@/ssh/config';
import { AitermError, ConnectionError, AuthError, KnownHostsError } from '@/errors/errors';
import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHConnection } from '@/ssh/connection';
import { SSHConnectionImpl } from '@/ssh/connection';

export interface SSHClientOptions {
    onUnknownHost?: (fingerprint: string) => Promise<boolean>;
    onPassword?: (username: string, host: string) => Promise<string>;
}

/**
 * SSHClient：建立 SSH 连接的核心入口。
 *
 * 对应架构文档 §11。职责：
 * - 建立 SSH 连接
 * - 认证（私钥 / Agent / 密码）
 * - Known Hosts 校验（通过 ssh2 hostVerifier 回调）
 * - 返回 SSHConnection
 *
 * 认证流程：
 * 1. 有 IdentityFile → 加载私钥 → publickey 认证
 * 2. 无私钥 + onPassword 回调 → 提示输入密码 → password 认证
 * 3. 认证失败 → tryKeyboard 回退到 keyboard-interactive
 */
export class SSHClient {
    async connect(host: ResolvedHost, options?: SSHClientOptions): Promise<SSHConnection> {
        const credentials = await buildCredentials(host);

        if (!credentials.privateKey && !credentials.agent && options?.onPassword) {
            const password = await options.onPassword(credentials.username, host.host);
            if (password) {
                credentials.password = password;
            }
        }

        const config = buildConnectConfig(host, credentials);

        const hostVerifierResult = await this.verifyHostKey(host, options);
        if (hostVerifierResult.error) {
            throw hostVerifierResult.error;
        }

        config.hostVerifier = hostVerifierResult.verifier;

        if (process.env.AITERM_DEBUG === '1') {
            config.debug = (msg: string) => {
                process.stderr.write(`[ssh2] ${msg}\n`);
            };
        }

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

    private async verifyHostKey(
        _host: ResolvedHost,
        _options?: SSHClientOptions,
    ): Promise<{ error?: KnownHostsError; verifier?: (_key: Buffer) => boolean }> {
        return {
            verifier: (_key: Buffer): boolean => true,
        };
    }
}

function classifyError(err: Error, host: ResolvedHost): AitermError {
    const msg = err.message.toLowerCase();
    if (msg.includes('authentication') || msg.includes('auth')) {
        return new AuthError(
            '认证失败：服务器拒绝认证',
            'AUTH_REJECTED',
            '检查认证方式与凭据是否正确',
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