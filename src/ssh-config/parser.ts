import { ConfigError } from '@/errors/errors';
import type { HostBlock, SSHConfig } from '@/ssh-config/model';

/**
 * SSH Config 文本解析器。
 *
 * 将 SSH Config 文本解析为 HostBlock 数组，对应架构文档 §8。
 * 第一阶段仅支持 Host / HostName / User / Port / IdentityFile 五条指令。
 *
 * 解析规则：
 * - 以 `Host` 行开始一个新块
 * - 非 Host 行为当前块的指令，格式为 `Keyword Value`（值可含空格，取首个 token 后的全文）
 * - 空行与 `#` 开头行忽略
 * - 文件开头、Host 块之前的全局指令归入 patterns=['*'] 的全局块
 *
 * @param text SSH Config 文件全文
 * @returns 解析后的 SSHConfig
 * @throws ConfigError 当遇到无法识别的行格式时
 *
 * @example
 * ```ts
 * const config = parse(`
 *   Host production
 *     HostName 192.168.1.100
 *     User root
 *     Port 22
 *     IdentityFile ~/.ssh/id_ed25519
 * `);
 * // config.blocks[0].patterns → ['production']
 * // config.blocks[0].directives.get('HostName') → ['192.168.1.100']
 * ```
 */
export function parse(text: string): SSHConfig {
    const blocks: HostBlock[] = [];
    let currentBlock: HostBlock | null = null;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (line === '' || line.startsWith('#')) continue;

        const keywordMatch = line.match(/^(\S+)\s+(.*)$/);
        if (!keywordMatch || keywordMatch.length < 3) {
            throw new ConfigError(
                `SSH Config 第 ${i + 1} 行格式无法识别: "${line}"`,
                'CONFIG_PARSE_ERROR',
                '检查 SSH Config 文件语法，每行应为 Keyword Value 格式',
            );
        }

        const keyword = keywordMatch[1]!;
        const value = keywordMatch[2]!;

        if (keyword === 'Host') {
            currentBlock = {
                patterns: value.split(/\s+/),
                directives: new Map(),
            };
            blocks.push(currentBlock);
        } else {
            if (!currentBlock) {
                currentBlock = {
                    patterns: ['*'],
                    directives: new Map(),
                };
                blocks.push(currentBlock);
            }
            const existing = currentBlock.directives.get(keyword) ?? [];
            existing.push(value);
            currentBlock.directives.set(keyword, existing);
        }
    }

    return { blocks };
}

/**
 * 从 SSHConfig 中提取所有命名 Host（排除通配符 *）。
 *
 * @param config 解析后的 SSHConfig
 * @returns 去重后的 Host pattern 列表
 */
export function getNamedHosts(config: SSHConfig): string[] {
    const hosts: string[] = [];
    for (const block of config.blocks) {
        for (const pattern of block.patterns) {
            if (pattern !== '*' && !hosts.includes(pattern)) {
                hosts.push(pattern);
            }
        }
    }
    return hosts;
}