import type { Client } from '@/ssh/transport';
import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHSession } from '@/ssh/session';
import type { ExecResult, ExecOptions } from '@/ssh/exec';
import { SSHSessionImpl } from '@/ssh/session';
import { ExecError } from '@/errors/errors';

/**
 * SSHConnection 接口与实现。
 *
 * 对应架构文档 §12。核心能力：
 * - exec：一次性命令执行（Phase 3 完整实现，含超时）
 * - createSession：交互式 PTY 会话
 * - close：关闭连接
 *
 * exec 与 createSession 使用不同的 SSH Channel（exec channel vs shell channel），
 * 互不干扰，对应验收 A3.8。
 */

export interface SSHConnection {
    exec(command: string, options?: ExecOptions): Promise<ExecResult>;
    createSession(options?: SessionOptions): Promise<SSHSession>;
    close(): Promise<void>;
}

export interface SessionOptions {
    term?: string;
    cols?: number;
    rows?: number;
}

export class SSHConnectionImpl implements SSHConnection {
    private client: Client;
    private host: ResolvedHost;
    private closed = false;

    constructor(client: Client, host: ResolvedHost) {
        this.client = client;
        this.host = host;
    }

    /**
     * 执行一次性远程命令。
     *
     * 通过 ssh2 exec channel 执行命令，收集 stdout/stderr/exitCode。
     * 与 createSession（shell channel）使用不同 Channel，互不干扰。
     *
     * @param command 远程命令字符串，原样传递到远程，不在本地解析
     * @param options 执行选项（超时等）
     * @returns ExecResult 包含 stdout、stderr、exitCode
     * @throws ExecError 超时时抛出 EXEC_TIMEOUT
     */
    async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
        return new Promise<ExecResult>((resolve, reject) => {
            this.client.exec(command, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!stream) {
                    reject(new Error('未获取到 exec stream'));
                    return;
                }

                let stdout = '';
                let stderr = '';
                let settled = false;
                let exitCode = 0;
                let timer: ReturnType<typeof setTimeout> | undefined;

                const cleanup = () => {
                    if (timer !== undefined) {
                        clearTimeout(timer);
                        timer = undefined;
                    }
                    stream.removeListener('data', onStdout);
                    stream.removeListener('error', onError);
                    stream.removeListener('close', onClose);
                    stream.removeListener('exit', onExit);
                    stream.stderr.removeListener('data', onStderr);
                };

                const onStdout = (data: Buffer) => {
                    stdout += data.toString('utf-8');
                };

                const onStderr = (data: Buffer) => {
                    stderr += data.toString('utf-8');
                };

                const onExit = (code: number) => {
                    exitCode = code;
                };

                const onClose = () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve({ stdout, stderr, exitCode });
                };

                const onError = (streamErr: Error) => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    reject(streamErr);
                };

                stream.on('data', onStdout);
                stream.stderr.on('data', onStderr);
                stream.on('exit', onExit);
                stream.on('close', onClose);
                stream.on('error', onError);

                if (options?.timeout && options.timeout > 0) {
                    timer = setTimeout(() => {
                        if (settled) return;
                        settled = true;
                        cleanup();
                        stream.close();
                        reject(
                            new ExecError(
                                `命令执行超时（${options.timeout}ms）`,
                                'EXEC_TIMEOUT',
                                '增加 --timeout 值或检查远程命令是否阻塞',
                            ),
                        );
                    }, options.timeout);
                }
            });
        });
    }

    /**
     * 创建交互式 PTY 会话。
     *
     * 通过 ssh2 shell channel 创建交互式 PTY，与 exec channel 互不干扰。
     *
     * @param options 会话选项（终端类型、初始尺寸）
     * @returns SSHSession 实例
     */
    async createSession(options?: SessionOptions): Promise<SSHSession> {
        return new Promise<SSHSession>((resolve, reject) => {
            const term = options?.term ?? 'xterm-256color';
            const cols = options?.cols ?? 80;
            const rows = options?.rows ?? 24;

            this.client.shell(
                { term, cols, rows },
                (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!stream) {
                        reject(new Error('未获取到 PTY stream'));
                        return;
                    }
                    resolve(new SSHSessionImpl(stream));
                },
            );
        });
    }

    /**
     * 关闭 SSH 连接。
     */
    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        return new Promise((resolve) => {
            this.client.on('close', () => resolve());
            this.client.end();
        });
    }
}