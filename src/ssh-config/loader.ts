import { readFile } from 'node:fs/promises';

import { ConfigError } from '@/errors/errors';
import { getSshConfigPath } from '@/platform/paths';
import { parse } from '@/ssh-config/parser';
import type { SSHConfig } from '@/ssh-config/model';

/**
 * SSH Config 文件加载器。
 *
 * 读取 SSH Config 文件并调用 Parser 解析，对应架构文档 §8。
 * 支持自定义路径（--config 选项）与默认路径（~/.ssh/config）。
 *
 * @param configPath 可选的自定义配置路径，默认使用 ~/.ssh/config
 * @returns 解析后的 SSHConfig
 * @throws ConfigError 文件不存在或读取失败时
 *
 * @example
 * ```ts
 * const config = await load();                  // 使用默认路径
 * const config = await load('/etc/ssh/config'); // 使用自定义路径
 * ```
 */
export async function load(configPath?: string): Promise<SSHConfig> {
    const filePath = configPath ?? getSshConfigPath();

    let text: string;
    try {
        text = await readFile(filePath, 'utf-8');
    } catch (error) {
        if (
            error instanceof Error &&
            'code' in error &&
            (error as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
            throw new ConfigError(
                `SSH Config 文件不存在: ${filePath}`,
                'CONFIG_NOT_FOUND',
                '确认 ~/.ssh/config 文件存在，或使用 --config 指定路径',
            );
        }
        throw new ConfigError(
            `无法读取 SSH Config 文件: ${filePath}`,
            'CONFIG_PARSE_ERROR',
            '检查文件权限与路径是否正确',
        );
    }

    return parse(text);
}

/**
 * 检查 SSH Config 有效性。
 *
 * 验证所有命名 Host 块是否包含 HostName 指令，
 * 返回问题列表。无问题时列表为空。
 *
 * @param config 解析后的 SSHConfig
 * @returns 问题列表，每项包含 host 名与问题描述
 */
export function check(config: SSHConfig): { host: string; problem: string }[] {
    const issues: { host: string; problem: string }[] = [];

    for (const block of config.blocks) {
        for (const pattern of block.patterns) {
            if (pattern === '*') continue;
            if (!block.directives.has('HostName')) {
                issues.push({ host: pattern, problem: 'missing HostName' });
            }
        }
    }

    return issues;
}