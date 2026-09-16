import { ConfigError } from '@/errors/errors';
import { expandTilde } from '@/platform/paths';
import type { HostBlock, ResolvedHost, SSHConfig } from '@/ssh-config/model';
import { DEFAULT_SSH_PORT, getDefaultUsername } from '@/ssh-config/model';

/**
 * Host Resolver：将用户输入的 Target 解析为 ResolvedHost。
 *
 * 对应架构文档 §9–§10。Target 与 ResolvedHost 必须分离，
 * SSH Client 只接收 ResolvedHost，不感知 SSH Config。
 *
 * 解析规则：
 * - 按 SSH Config 文件顺序匹配首个 pattern 命中 Target 的块
 * - HostName 缺省时使用 Target 本身（即 Host pattern 作为主机名）
 * - Port 缺省为 22
 * - User 缺省为当前系统用户
 * - IdentityFile 中的 `~` 展开为 home 目录
 *
 * @param config 解析后的 SSHConfig
 * @param target 用户输入的目标名称
 * @returns 解析后的 ResolvedHost
 * @throws ConfigError Target 未在配置中找到时
 *
 * @example
 * ```ts
 * const resolved = resolve(config, 'production');
 * // { host: '192.168.1.100', port: 22, username: 'root', identityFiles: [...] }
 * ```
 */
export function resolve(config: SSHConfig, target: string): ResolvedHost {
    const block = findBlock(config.blocks, target);
    if (!block) {
        throw new ConfigError(
            `未找到 Host 配置: ${target}`,
            'CONFIG_HOST_UNKNOWN',
            `使用 'aiterm host list' 查看可用 Host，或在 ~/.ssh/config 中添加 Host ${target}`,
        );
    }
    return resolveBlock(block, target);
}

/**
 * 在 Host 块列表中查找匹配 Target 的首个块。
 *
 * @param blocks 所有 Host 块
 * @param target 目标名称
 * @returns 匹配的 HostBlock 或 null
 */
function findBlock(blocks: HostBlock[], target: string): HostBlock | null {
    for (const block of blocks) {
        if (block.patterns.includes(target)) {
            return block;
        }
    }
    return null;
}

/**
 * 将单个 HostBlock 解析为 ResolvedHost。
 *
 * @param block 匹配的 Host 块
 * @param target 原始 Target 名称（HostName 缺省时使用）
 * @returns 解析结果
 */
function resolveBlock(block: HostBlock, target: string): ResolvedHost {
    const hostName = getFirstValue(block, 'HostName') ?? target;
    const port = parseInt(getFirstValue(block, 'Port') ?? String(DEFAULT_SSH_PORT), 10);
    const username = getFirstValue(block, 'User') ?? getDefaultUsername();
    const identityFiles = (block.directives.get('IdentityFile') ?? []).map(expandTilde);

    return {
        host: hostName,
        port: Number.isNaN(port) ? DEFAULT_SSH_PORT : port,
        username,
        identityFiles,
    };
}

/**
 * 获取指令的首个值。
 *
 * @param block Host 块
 * @param directive 指令名
 * @returns 首个值或 undefined
 */
function getFirstValue(block: HostBlock, directive: string): string | undefined {
    const values = block.directives.get(directive);
    return values?.[0];
}