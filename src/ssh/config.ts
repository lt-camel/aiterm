import type { ConnectConfig } from '@/ssh/transport';
import type { ResolvedHost } from '@/ssh-config/model';

/**
 * SSH 连接配置构建模块。
 *
 * 将 ResolvedHost + 认证凭据转换为 ssh2 ConnectConfig。
 * 对应架构文档 §10–§11：SSHClient 只接收 ResolvedHost，不感知 SSH Config。
 */

export interface SSHConnectConfig extends ConnectConfig {
    host: string;
    port: number;
    username: string;
    privateKey: Buffer;
}

/**
 * 构建 ssh2 连接配置。
 *
 * @param resolved 已解析的目标主机
 * @param privateKey 私钥 Buffer
 * @returns ssh2 ConnectConfig
 */
export function buildConnectConfig(resolved: ResolvedHost, privateKey: Buffer): SSHConnectConfig {
    return {
        host: resolved.host,
        port: resolved.port,
        username: resolved.username,
        privateKey,
        readyTimeout: 20_000,
    };
}