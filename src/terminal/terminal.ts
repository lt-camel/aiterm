import type { SSHSession } from '@/ssh/session';

/**
 * 本地终端适配器。
 *
 * 对应架构文档 §17。将本地 stdin/stdout/resize/signal
 * 与 SSHSession 的双向流对接。
 *
 * 职责：
 * - 将 stdin 数据写入 SSHSession
 * - 将 SSHSession 输出写入 stdout
 * - 监听终端 resize 事件，同步远程 PTY
 * - 传递信号（Ctrl+C 等）
 * - SSH escape 序列：Enter ~ . 断开连接
 * - 远程关闭时自动清理
 *
 * attachTerminal 返回 Promise，在会话结束时 resolve。
 */

export interface TerminalAdapter {
    pipeToSession(session: SSHSession): Promise<void>;
    close(): void;
}

/**
 * 获取当前终端尺寸。
 *
 * @returns { cols, rows } 或默认 80x24
 */
export function getTerminalSize(): { cols: number; rows: number } {
    if (process.stdout.isTTY && typeof process.stdout.columns === 'number') {
        return {
            cols: process.stdout.columns,
            rows: process.stdout.rows,
        };
    }
    return { cols: 80, rows: 24 };
}

/**
 * SSH escape 序列状态机。
 *
 * 标准 SSH 客户端使用 Enter ~ . 断开连接。
 * 状态流转：IDLE → AFTER_NEWLINE → AFTER_TILDE → DISCONNECT
 *
 * Enter（\r 或 \n）后输入 ~ 进入 escape 前缀，
 * 再输入 . 断开连接，输入其他字符取消 escape。
 */
enum EscapeState {
    IDLE,
    AFTER_NEWLINE,
    AFTER_TILDE,
}

/**
 * 将本地终端与 SSH Session 双向绑定。
 *
 * - stdin → session.write（含 escape 序列检测）
 * - session.onData → stdout
 * - session.onClose → 清理 + resolve
 * - 终端 resize → session.resize
 *
 * @param session SSH 会话
 * @returns Promise，会话结束时 resolve；resolve 值为 true 表示用户主动 escape 断开
 */
export function attachTerminal(session: SSHSession): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const cleanups: (() => void)[] = [];
        let escapeState = EscapeState.IDLE;
        let resolved = false;

        const finish = (userInitiated: boolean) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve(userInitiated);
        };

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();

        const onData = (chunk: Buffer) => {
            if (resolved) return;

            const input = new Uint8Array(chunk);

            for (let i = 0; i < input.length; i++) {
                const byte = input[i]!;

                if (escapeState === EscapeState.AFTER_TILDE) {
                    if (byte === 0x2e) {
                        finish(true);
                        return;
                    }
                    escapeState = EscapeState.IDLE;
                    session.write(new Uint8Array([0x7e, byte])).catch(() => {});
                    continue;
                }

                if (escapeState === EscapeState.AFTER_NEWLINE && byte === 0x7e) {
                    escapeState = EscapeState.AFTER_TILDE;
                    continue;
                }

                if (byte === 0x0d || byte === 0x0a) {
                    escapeState = EscapeState.AFTER_NEWLINE;
                } else {
                    escapeState = EscapeState.IDLE;
                }

                session.write(new Uint8Array([byte])).catch(() => {});
            }
        };
        process.stdin.on('data', onData);

        session.onData((data) => {
            if (!resolved) {
                process.stdout.write(data);
            }
        });

        session.onClose(() => {
            finish(false);
        });

        if (process.stdout.isTTY && typeof process.stdout.on === 'function') {
            const onResize = () => {
                const size = getTerminalSize();
                session.resize(size.cols, size.rows).catch(() => {});
            };
            process.stdout.on('resize', onResize);
            cleanups.push(() => process.stdout.off('resize', onResize));
        }

        const cleanup = () => {
            process.stdin.removeListener('data', onData);
            for (const fn of cleanups) fn();
            if (process.stdin.isTTY) {
                try {
                    process.stdin.setRawMode(false);
                } catch {
                    // ignore
                }
            }
            process.stdin.pause();
        };
    });
}