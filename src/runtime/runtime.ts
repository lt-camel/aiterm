import { load as loadConfig, check as checkConfig } from '@/ssh-config/loader';
import { resolve as resolveTarget } from '@/ssh-config/resolver';
import { getNamedHosts } from '@/ssh-config/parser';
import type { ResolvedHost, SSHConfig } from '@/ssh-config/model';
import { SSHClient } from '@/ssh/client';
import type { SSHClientOptions } from '@/ssh/client';
import type { SSHConnection } from '@/ssh/connection';
import type { ExecResult, ExecOptions } from '@/ssh/exec';
import type { TransferResult, TransferOptions } from '@/ssh/transfer';

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

    /**
     * 执行一次性远程命令。
     *
     * 编排流程：connect → exec → close，确保连接在 finally 中关闭。
     *
     * @param host 已解析的目标主机信息
     * @param command 远程命令字符串
     * @param options 执行选项（超时等）与连接选项
     * @returns ExecResult 包含 stdout、stderr、exitCode
     */
    async exec(
        host: ResolvedHost,
        command: string,
        options?: ExecOptions & { connectOptions?: SSHClientOptions },
    ): Promise<ExecResult> {
        const connection = await this.sshClient.connect(host, options?.connectOptions);
        try {
            return await connection.exec(command, options);
        } finally {
            await connection.close();
        }
    }

    /**
     * 上传文件到远程主机。
     *
     * 编排流程：connect → upload/uploadDir → close，确保连接在 finally 中关闭。
     *
     * @param host 已解析的目标主机信息
     * @param localPath 本地文件/目录路径
     * @param remotePath 远程文件/目录路径
     * @param options 传输选项与连接选项
     * @returns TransferResult
     */
    async upload(
        host: ResolvedHost,
        localPath: string,
        remotePath: string,
        options?: TransferOptions & { connectOptions?: SSHClientOptions },
    ): Promise<TransferResult> {
        const connection = await this.sshClient.connect(host, options?.connectOptions);
        try {
            if (options?.recursive) {
                return await connection.uploadDir(localPath, remotePath, options);
            }
            return await connection.upload(localPath, remotePath, options);
        } finally {
            await connection.close();
        }
    }

    /**
     * 从远程主机下载文件。
     *
     * 编排流程：connect → download/downloadDir → close，确保连接在 finally 中关闭。
     *
     * @param host 已解析的目标主机信息
     * @param remotePath 远程文件/目录路径
     * @param localPath 本地文件/目录路径
     * @param options 传输选项与连接选项
     * @returns TransferResult
     */
    async download(
        host: ResolvedHost,
        remotePath: string,
        localPath: string,
        options?: TransferOptions & { connectOptions?: SSHClientOptions },
    ): Promise<TransferResult> {
        const connection = await this.sshClient.connect(host, options?.connectOptions);
        try {
            if (options?.recursive) {
                return await connection.downloadDir(remotePath, localPath, options);
            }
            return await connection.download(remotePath, localPath, options);
        } finally {
            await connection.close();
        }
    }
}