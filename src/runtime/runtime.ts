import { load as loadConfig, check as checkConfig } from '@/ssh-config/loader';
import { resolve as resolveTarget } from '@/ssh-config/resolver';
import { getNamedHosts } from '@/ssh-config/parser';
import type { ResolvedHost, SSHConfig } from '@/ssh-config/model';
import { SSHClient } from '@/ssh/client';
import type { SSHClientOptions } from '@/ssh/client';
import type { SSHConnection } from '@/ssh/connection';

/**
 * Runtime：应用层编排入口。
 *
 * 对应架构文档 §22。Runtime 不是远程 Provider，
 * 只负责组装 SSH Config 加载、解析、Target 解析、SSH 连接等流程。
 * CLI 通过 Runtime 调用核心能力，不直接操作 ssh-config 或 ssh 模块。
 *
 * @example
 * ```ts
 * const runtime = new Runtime();
 * const config = await runtime.loadConfig();
 * const resolved = runtime.resolveTarget(config, 'production');
 * const conn = await runtime.connect(resolved);
 * ```
 */
export class Runtime {
    private sshClient: SSHClient;

    constructor() {
        this.sshClient = new SSHClient();
    }

    /**
     * 加载并解析 SSH Config 文件。
     *
     * @param configPath 可选的自定义配置路径
     * @returns 解析后的 SSHConfig
     */
    async loadConfig(configPath?: string): Promise<SSHConfig> {
        return loadConfig(configPath);
    }

    /**
     * 检查 SSH Config 有效性。
     *
     * @param config 解析后的 SSHConfig
     * @returns 问题列表，为空表示配置有效
     */
    checkConfig(config: SSHConfig): { host: string; problem: string }[] {
        return checkConfig(config);
    }

    /**
     * 将 Target 解析为 ResolvedHost。
     *
     * @param config 解析后的 SSHConfig
     * @param target 用户输入的目标名称
     * @returns 解析结果
     */
    resolveTarget(config: SSHConfig, target: string): ResolvedHost {
        return resolveTarget(config, target);
    }

    /**
     * 获取所有命名 Host 列表。
     *
     * @param config 解析后的 SSHConfig
     * @returns Host 名称列表
     */
    listHosts(config: SSHConfig): string[] {
        return getNamedHosts(config);
    }

    /**
     * 建立到远程主机的 SSH 连接。
     *
     * @param host 已解析的目标主机信息
     * @param options 连接选项（如 Known Hosts 确认回调）
     * @returns SSHConnection 实例
     */
    async connect(
        host: ResolvedHost,
        options?: SSHClientOptions,
    ): Promise<SSHConnection> {
        return this.sshClient.connect(host, options);
    }
}