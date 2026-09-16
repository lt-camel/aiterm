import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * 平台相关路径定位。
 *
 * 提供 SSH 相关目录与文件的绝对路径，兼容 Windows / macOS / Linux。
 * Windows 下 %USERPROFILE%\.ssh 等价于 os.homedir() + '/.ssh'。
 *
 * @example
 * ```ts
 * import { getSshDir, getSshConfigPath } from '@/platform/paths';
 * console.log(getSshDir());        // '/home/user/.ssh'
 * console.log(getSshConfigPath()); // '/home/user/.ssh/config'
 * ```
 */
export function getSshDir(): string {
    return join(homedir(), '.ssh');
}

/**
 * 获取 SSH Config 文件默认路径。
 *
 * @returns 绝对路径，如 `/home/user/.ssh/config` 或 `C:\Users\xxx\.ssh\config`
 */
export function getSshConfigPath(): string {
    return join(getSshDir(), 'config');
}

/**
 * 获取 known_hosts 文件默认路径。
 *
 * @returns 绝对路径
 */
export function getKnownHostsPath(): string {
    return join(getSshDir(), 'known_hosts');
}

/**
 * 将路径中的 `~` 或 `~/` 前缀展开为 home 目录绝对路径。
 *
 * - `~` → `/home/user`
 * - `~/foo` → `/home/user/foo`
 * - 非 `~` 开头路径原样返回
 *
 * @param filePath 可能包含 `~` 的路径
 * @returns 展开后的绝对路径
 */
export function expandTilde(filePath: string): string {
    if (filePath === '~') return homedir();
    if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
    return filePath;
}