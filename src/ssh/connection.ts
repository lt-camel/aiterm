import type { Client, SFTPWrapper } from '@/ssh/transport';
import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHSession } from '@/ssh/session';
import type { ExecResult, ExecOptions } from '@/ssh/exec';
import type { TransferResult, TransferOptions } from '@/ssh/transfer';
import { SSHSessionImpl } from '@/ssh/session';
import { ExecError, TransferError } from '@/errors/errors';
import { createReadStream, createWriteStream, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { promisify } from 'node:util';

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
    upload(localPath: string, remotePath: string, options?: TransferOptions): Promise<TransferResult>;
    download(remotePath: string, localPath: string, options?: TransferOptions): Promise<TransferResult>;
    uploadDir(localPath: string, remotePath: string, options?: TransferOptions): Promise<TransferResult>;
    downloadDir(remotePath: string, localPath: string, options?: TransferOptions): Promise<TransferResult>;
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

    private getSFTP(): Promise<SFTPWrapper> {
        return new Promise<SFTPWrapper>((resolve, reject) => {
            this.client.sftp((err, sftp) => {
                if (err) {
                    reject(
                        new TransferError(
                            `SFTP subsystem 不可用: ${err.message}`,
                            'TRANSFER_SFTP_UNAVAILABLE',
                            '确认远程服务器支持 SFTP subsystem',
                        ),
                    );
                    return;
                }
                if (!sftp) {
                    reject(
                        new TransferError(
                            'SFTP subsystem 返回空',
                            'TRANSFER_SFTP_UNAVAILABLE',
                            '确认远程服务器支持 SFTP subsystem',
                        ),
                    );
                    return;
                }
                resolve(sftp);
            });
        });
    }

    /**
     * 上传单个文件到远程。
     *
     * 通过 SFTP Stream pipe 传输，二进制模式，不区分文件类型。
     *
     * @param localPath 本地文件路径
     * @param remotePath 远程文件路径
     * @param options 传输选项（进度回调）
     * @returns TransferResult
     * @throws TransferError 本地路径不存在或远程写入失败
     */
    async upload(localPath: string, remotePath: string, options?: TransferOptions): Promise<TransferResult> {
        let localStat: ReturnType<typeof statSync>;
        try {
            localStat = statSync(localPath);
        } catch {
            throw new TransferError(
                `本地路径不存在: ${localPath}`,
                'TRANSFER_LOCAL_NOT_FOUND',
                '检查本地文件路径是否正确',
            );
        }

        if (!localStat.isFile()) {
            throw new TransferError(
                `本地路径不是文件: ${localPath}`,
                'TRANSFER_LOCAL_NOT_FILE',
                '使用 --recursive 选项上传目录',
            );
        }

        const sftp = await this.getSFTP();
        const total = localStat.size;
        let transferred = 0;

        return new Promise<TransferResult>((resolve, reject) => {
            const readStream = createReadStream(localPath);
            const writeStream = sftp.createWriteStream(remotePath);

            readStream.on('data', (chunk: string | Buffer) => {
                transferred += Buffer.byteLength(chunk);
                options?.onProgress?.(transferred, total);
            });

            writeStream.on('close', () => {
                resolve({ bytes: transferred, local: localPath, remote: remotePath });
            });

            writeStream.on('error', (err: Error) => {
                reject(
                    new TransferError(
                        `上传失败: ${err.message}`,
                        'TRANSFER_REMOTE_WRITE_ERROR',
                        '检查远程路径与写入权限',
                    ),
                );
            });

            readStream.on('error', (err: Error) => {
                reject(
                    new TransferError(
                        `读取本地文件失败: ${err.message}`,
                        'TRANSFER_LOCAL_READ_ERROR',
                        '检查本地文件权限',
                    ),
                );
            });

            readStream.pipe(writeStream);
        });
    }

    /**
     * 从远程下载单个文件。
     *
     * 通过 SFTP Stream pipe 传输，二进制模式，不区分文件类型。
     *
     * @param remotePath 远程文件路径
     * @param localPath 本地文件路径
     * @param options 传输选项（进度回调）
     * @returns TransferResult
     * @throws TransferError 远程路径不存在或本地写入失败
     */
    async download(remotePath: string, localPath: string, options?: TransferOptions): Promise<TransferResult> {
        const sftp = await this.getSFTP();

        const statAsync = promisify(sftp.stat).bind(sftp);
        let remoteStat: { size: number };
        try {
            remoteStat = await statAsync(remotePath);
        } catch {
            throw new TransferError(
                `远程路径不存在: ${remotePath}`,
                'TRANSFER_REMOTE_NOT_FOUND',
                '检查远程文件路径是否正确',
            );
        }

        const total = remoteStat.size;
        let transferred = 0;

        const localDir = dirname(localPath);
        try {
            mkdirSync(localDir, { recursive: true });
        } catch {
            // 目录已存在，忽略
        }

        return new Promise<TransferResult>((resolve, reject) => {
            const readStream = sftp.createReadStream(remotePath);
            const writeStream = createWriteStream(localPath);

            readStream.on('data', (chunk: string | Buffer) => {
                transferred += Buffer.byteLength(chunk);
                options?.onProgress?.(transferred, total);
            });

            writeStream.on('close', () => {
                resolve({ bytes: transferred, local: localPath, remote: remotePath });
            });

            writeStream.on('error', (err: Error) => {
                reject(
                    new TransferError(
                        `写入本地文件失败: ${err.message}`,
                        'TRANSFER_LOCAL_WRITE_ERROR',
                        '检查本地路径与写入权限',
                    ),
                );
            });

            readStream.on('error', (err: Error) => {
                reject(
                    new TransferError(
                        `下载失败: ${err.message}`,
                        'TRANSFER_REMOTE_READ_ERROR',
                        '检查远程文件权限',
                    ),
                );
            });

            readStream.pipe(writeStream);
        });
    }

    /**
     * 递归上传本地目录到远程。
     *
     * 纯 SFTP 协议原语（mkdir + 逐文件 upload），不调用远程 Shell 命令。
     *
     * @param localPath 本地目录路径
     * @param remotePath 远程目录路径
     * @param options 传输选项（进度回调）
     * @returns TransferResult 汇总字节数
     * @throws TransferError 本地路径不存在或不是目录
     */
    async uploadDir(localPath: string, remotePath: string, options?: TransferOptions): Promise<TransferResult> {
        let localStat: ReturnType<typeof statSync>;
        try {
            localStat = statSync(localPath);
        } catch {
            throw new TransferError(
                `本地路径不存在: ${localPath}`,
                'TRANSFER_LOCAL_NOT_FOUND',
                '检查本地目录路径是否正确',
            );
        }

        if (!localStat.isDirectory()) {
            throw new TransferError(
                `本地路径不是目录: ${localPath}`,
                'TRANSFER_LOCAL_NOT_DIR',
                '去掉 --recursive 选项上传单个文件',
            );
        }

        const sftp = await this.getSFTP();
        const mkdirAsync = promisify(sftp.mkdir).bind(sftp);

        let totalBytes = 0;
        const files = this.collectLocalFiles(localPath);

        try {
            await mkdirAsync(remotePath);
        } catch {
            // 目录已存在，忽略
        }

        for (const relPath of files) {
            const fullLocal = join(localPath, relPath);
            const fullRemote = join(remotePath, relPath).split(sep).join('/');

            const remoteDir = dirname(fullRemote).split(sep).join('/');
            await this.ensureRemoteDir(sftp, remoteDir);

            const result = await this.upload(fullLocal, fullRemote, {
                onProgress: options?.onProgress,
            });
            totalBytes += result.bytes;
        }

        return { bytes: totalBytes, local: localPath, remote: remotePath };
    }

    /**
     * 递归下载远程目录到本地。
     *
     * 纯 SFTP 协议原语（readdir + stat + mkdir + 逐文件 download），不调用远程 Shell 命令。
     *
     * @param remotePath 远程目录路径
     * @param localPath 本地目录路径
     * @param options 传输选项（进度回调）
     * @returns TransferResult 汇总字节数
     * @throws TransferError 远程路径不存在或不是目录
     */
    async downloadDir(remotePath: string, localPath: string, options?: TransferOptions): Promise<TransferResult> {
        const sftp = await this.getSFTP();
        const statAsync = promisify(sftp.stat).bind(sftp);

        let remoteStat: { isDirectory(): boolean };
        try {
            remoteStat = await statAsync(remotePath);
        } catch {
            throw new TransferError(
                `远程路径不存在: ${remotePath}`,
                'TRANSFER_REMOTE_NOT_FOUND',
                '检查远程目录路径是否正确',
            );
        }

        if (!remoteStat.isDirectory()) {
            throw new TransferError(
                `远程路径不是目录: ${remotePath}`,
                'TRANSFER_REMOTE_NOT_DIR',
                '去掉 --recursive 选项下载单个文件',
            );
        }

        let totalBytes = 0;
        const files = await this.collectRemoteFiles(sftp, remotePath);

        mkdirSync(localPath, { recursive: true });

        for (const relPath of files) {
            const fullRemote = join(remotePath, relPath).split(sep).join('/');
            const fullLocal = join(localPath, relPath);

            const localDir = dirname(fullLocal);
            mkdirSync(localDir, { recursive: true });

            const result = await this.download(fullRemote, fullLocal, {
                onProgress: options?.onProgress,
            });
            totalBytes += result.bytes;
        }

        return { bytes: totalBytes, local: localPath, remote: remotePath };
    }

    private collectLocalFiles(base: string): string[] {
        const result: string[] = [];
        const walk = (dir: string) => {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    result.push(relative(base, fullPath).split(sep).join('/'));
                }
            }
        };
        walk(base);
        return result;
    }

    private async collectRemoteFiles(sftp: SFTPWrapper, base: string): Promise<string[]> {
        const result: string[] = [];
        const readdirAsync = promisify(sftp.readdir).bind(sftp);

        const walk = async (dir: string) => {
            const entries = await readdirAsync(dir);
            for (const entry of entries) {
                const fullPath = dir === '/' ? `/${entry.filename}` : `${dir}/${entry.filename}`;
                const attrs = entry.attrs;
                if (attrs.isDirectory()) {
                    await walk(fullPath);
                } else if (attrs.isFile()) {
                    const rel = fullPath.startsWith(base + '/')
                        ? fullPath.slice(base.length + 1)
                        : fullPath;
                    result.push(rel);
                }
            }
        };
        await walk(base);
        return result;
    }

    private async ensureRemoteDir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
        const mkdirAsync = promisify(sftp.mkdir).bind(sftp);
        const parts = remotePath.split('/').filter(Boolean);
        let current = remotePath.startsWith('/') ? '/' : '';

        for (const part of parts) {
            current = current === '/' ? `/${part}` : `${current}/${part}`;
            try {
                await mkdirAsync(current);
            } catch {
                // 目录已存在，忽略
            }
        }
    }
}