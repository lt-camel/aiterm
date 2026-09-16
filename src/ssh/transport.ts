import { Client } from 'ssh2';

/**
 * SSH Transport Adapter：隔离 ssh2 底层实现。
 *
 * 对应架构文档 §35。上层模块禁止直接 import ssh2，
 * 必须经此 Adapter 访问。未来替换底层 SSH 库时只需修改此文件。
 *
 * 导出 ssh2 类型供上层使用，避免上层 import ssh2。
 *
 * @example
 * ```ts
 * import { createClient } from '@/ssh/transport';
 * const client = createClient();
 * ```
 */

export type { Client, ClientChannel } from 'ssh2';
export type { ConnectConfig } from 'ssh2';

/**
 * 创建 ssh2 Client 实例。
 *
 * @returns 新的 ssh2 Client
 */
export function createClient(): Client {
    return new Client();
}