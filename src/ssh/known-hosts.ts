import { readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { getKnownHostsPath } from '@/platform/paths';

/**
 * Known Hosts 校验模块。
 *
 * 对应架构文档 §20 与 Security-Guidelines §2。
 * 实现 Match / Unknown / Mismatch 三态处理：
 * - Match：继续连接
 * - Unknown：首次连接，提示用户确认
 * - Mismatch：拒绝连接，禁止 StrictHostKeyChecking=no 绕过
 *
 * Mismatch 错误只输出主机密钥指纹，不输出密钥全文。
 */

export enum KnownHostsStatus {
    Match = 'match',
    Unknown = 'unknown',
    Mismatch = 'mismatch',
}

export interface KnownHostsResult {
    status: KnownHostsStatus;
    key?: Buffer;
    fingerprint?: string;
}

/**
 * 计算主机密钥的 SHA256 指纹。
 *
 * @param key 主机公钥
 * @returns SHA256 指纹（base64，无填充）
 */
export function computeFingerprint(key: Buffer): string {
    const hash = createHash('sha256').update(key).digest('base64');
    return hash.replace(/=+$/, '');
}

/**
 * 解析 known_hosts 文件，查找匹配的主机条目。
 *
 * @param host 主机名或 IP
 * @param port 端口号
 * @param knownHostsPath known_hosts 文件路径
 * @returns 匹配的行列表（每行为原始文本）
 */
async function findKnownHostEntries(
    host: string,
    port: number,
    knownHostsPath: string,
): Promise<string[]> {
    if (!existsSync(knownHostsPath)) {
        return [];
    }
    const content = await readFile(knownHostsPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim() !== '');
    const entries: string[] = [];

    for (const line of lines) {
        const parts = line.split(' ');
        if (parts.length < 3) continue;
        const hostPart = parts[0]!;
        const bracketEnd = hostPart.indexOf(']');
        if (hostPart.startsWith('[') && bracketEnd !== -1) {
            const entryHost = hostPart.slice(1, bracketEnd);
            const afterBracket = hostPart.slice(bracketEnd + 1);
            if (afterBracket.startsWith(':')) {
                const entryPort = parseInt(afterBracket.slice(1), 10);
                if (entryHost === host && entryPort === port) {
                    entries.push(line);
                }
            }
        } else {
            if (port === 22 && hostPart === host) {
                entries.push(line);
            }
        }
    }
    return entries;
}

/**
 * 校验主机密钥与 known_hosts 记录。
 *
 * @param host 主机名
 * @param port 端口
 * @param remoteKey 远程主机公钥
 * @param knownHostsPath 可选的 known_hosts 路径
 * @returns 校验结果
 */
export async function verifyKnownHosts(
    host: string,
    port: number,
    remoteKey: Buffer,
    knownHostsPath?: string,
): Promise<KnownHostsResult> {
    const filePath = knownHostsPath ?? getKnownHostsPath();
    const entries = await findKnownHostEntries(host, port, filePath);

    if (entries.length === 0) {
        return {
            status: KnownHostsStatus.Unknown,
            key: remoteKey,
            fingerprint: computeFingerprint(remoteKey),
        };
    }

    for (const entry of entries) {
        const parts = entry.split(' ');
        if (parts.length >= 3) {
            const storedKeyBase64 = parts[2]!;
            const storedKey = Buffer.from(storedKeyBase64, 'base64');
            if (storedKey.equals(remoteKey)) {
                return { status: KnownHostsStatus.Match, key: remoteKey };
            }
        }
    }

    return {
        status: KnownHostsStatus.Mismatch,
        key: remoteKey,
        fingerprint: computeFingerprint(remoteKey),
    };
}

/**
 * 将主机公钥追加到 known_hosts 文件。
 *
 * @param host 主机名
 * @param port 端口
 * @param key 主机公钥
 * @param keyType 密钥类型（如 ssh-ed25519）
 * @param knownHostsPath 可选的 known_hosts 路径
 */
export async function appendToKnownHosts(
    host: string,
    port: number,
    key: Buffer,
    keyType: string,
    knownHostsPath?: string,
): Promise<void> {
    const filePath = knownHostsPath ?? getKnownHostsPath();
    const hostEntry = port === 22 ? host : `[${host}]:${port}`;
    const line = `${hostEntry} ${keyType} ${key.toString('base64')}\n`;
    await appendFile(filePath, line, 'utf-8');
}