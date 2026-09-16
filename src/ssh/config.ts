import type { ConnectConfig } from '@/ssh/transport';
import type { ResolvedHost } from '@/ssh-config/model';
import type { AuthCredentials } from '@/ssh/authentication';

/**
 * SSH 连接配置构建模块。
 *
 * 将 ResolvedHost + 认证凭据转换为 ssh2 ConnectConfig。
 * 对应架构文档 §10–§11：SSHClient 只接收 ResolvedHost，不感知 SSH Config。
 *
 * 认证策略：
 * - 有 privateKey → publickey 认证 + tryKeyboard 回退
 * - 有 agent → agent 认证 + tryKeyboard 回退
 * - 有 password → password 认证 + tryKeyboard 回退
 * - 无凭据 → tryKeyboard（keyboard-interactive / password 回退）
 */

export interface SSHConnectConfig extends ConnectConfig {
    host: string;
    port: number;
    username: string;
}

/**
 * 构建 ssh2 连接配置。
 *
 * @param resolved 已解析的目标主机
 * @param credentials 认证凭据
 * @returns ssh2 ConnectConfig
 */
export function buildConnectConfig(resolved: ResolvedHost, credentials: AuthCredentials): SSHConnectConfig {
    const config: SSHConnectConfig = {
        host: resolved.host,
        port: resolved.port,
        username: credentials.username,
        readyTimeout: 20_000,
    };

    if (credentials.privateKey) {
        config.privateKey = credentials.privateKey;
    }

    if (credentials.agent) {
        config.agent = credentials.agent;
    }

    if (credentials.password) {
        config.password = credentials.password;
    }

    if (credentials.tryKeyboard) {
        config.tryKeyboard = true;
    }

    return config;
}