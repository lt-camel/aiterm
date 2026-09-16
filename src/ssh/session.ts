import type { ClientChannel } from '@/ssh/transport';

/**
 * SSHSession：交互式 PTY 双向流。
 *
 * 对应架构文档 §16。提供：
 * - write：向远程 PTY 写入数据
 * - onData：接收远程 PTY 输出
 * - onClose：监听远程 PTY 关闭
 * - resize：调整远程 PTY 尺寸
 * - close：关闭会话
 */

export interface SSHSession {
    write(data: Uint8Array): Promise<void>;
    onData(callback: (data: Uint8Array) => void): void;
    onClose(callback: () => void): void;
    resize(cols: number, rows: number): Promise<void>;
    close(): Promise<void>;
}

export class SSHSessionImpl implements SSHSession {
    private stream: ClientChannel;

    constructor(stream: ClientChannel) {
        this.stream = stream;
    }

    async write(data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            this.stream.write(data, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    onData(callback: (data: Uint8Array) => void): void {
        this.stream.on('data', (data: Buffer) => {
            callback(new Uint8Array(data));
        });
    }

    /**
     * 注册远程 PTY 关闭回调。
     *
     * 当远程 shell 退出（exit/Ctrl+D）或连接断开时触发。
     *
     * @param callback 关闭回调
     */
    onClose(callback: () => void): void {
        this.stream.on('close', () => {
            callback();
        });
    }

    async resize(cols: number, rows: number): Promise<void> {
        this.stream.setWindow(rows, cols, 0, 0);
    }

    async close(): Promise<void> {
        return new Promise((resolve) => {
            this.stream.on('close', () => resolve());
            this.stream.end();
        });
    }
}