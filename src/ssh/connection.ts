import type { Client, ClientChannel } from '@/ssh/transport';
import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHSession } from '@/ssh/session';
import { SSHSessionImpl } from '@/ssh/session';

/**
 * SSHConnection 接口与实现。
 *
 * 对应架构文档 §12。核心能力：
 * - exec：一次性命令执行（Phase 3 完整实现）
 * - createSession：交互式 PTY 会话
 * - close：关闭连接
 */

export interface SSHConnection {
    exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
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
     * @param command 远程命令字符串
     * @returns 执行结果（stdout/stderr/exitCode）
     */
    async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        return new Promise((resolve, reject) => {
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

                stream.on('data', (data: Buffer) => {
                    stdout += data.toString('utf-8');
                });
                stream.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString('utf-8');
                });
                stream.on('close', () => {
                    const exitCode: number = (stream as ClientChannel & { exitCode: number }).exitCode ?? 0;
                    resolve({ stdout, stderr, exitCode });
                });
                stream.on('error', reject);
            });
        });
    }

    /**
     * 创建交互式 PTY 会话。
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