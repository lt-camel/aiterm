import type { SSHSession } from '@/ssh/session';

/**
 * 终端 resize 同步模块。
 *
 * 监听本地终端 resize 事件，同步到远程 PTY。
 */

/**
 * 监听本地终端 resize 并同步到远程会话。
 *
 * @param session SSH 会话
 * @returns 取消监听的清理函数
 */
export function watchResize(session: SSHSession): () => void {
    if (!process.stdout.isTTY) {
        return () => {};
    }

    const onResize = () => {
        const cols = process.stdout.columns ?? 80;
        const rows = process.stdout.rows ?? 24;
        session.resize(cols, rows).catch(() => {});
    };

    process.stdout.on('resize', onResize);

    return () => {
        process.stdout.off('resize', onResize);
    };
}