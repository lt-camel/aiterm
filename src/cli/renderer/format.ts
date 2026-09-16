import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHConfig } from '@/ssh-config/model';
import { getNamedHosts } from '@/ssh-config/parser';

/**
 * CLI 输出格式化模块。
 *
 * 对应 CLI-Spec §3，提供人类友好与 JSON 两种输出格式。
 * --json 选项为 Phase 5 Skill 层铺路，让 AI Agent 可解析输出。
 */

/**
 * 格式化 config path 输出。
 *
 * @param path SSH Config 文件路径
 * @param json 是否输出 JSON 格式
 */
export function formatConfigPath(path: string, json: boolean): string {
    if (json) {
        return JSON.stringify({ path });
    }
    return path;
}

/**
 * 格式化 config check 输出。
 *
 * @param issues 问题列表
 * @param json 是否输出 JSON 格式
 */
export function formatConfigCheck(
    issues: { host: string; problem: string }[],
    json: boolean,
): string {
    if (json) {
        return JSON.stringify({ ok: issues.length === 0, issues });
    }
    if (issues.length === 0) {
        return '✓ Config syntax OK';
    }
    const lines = issues.map((i) => `✗ Host '${i.host}' ${i.problem}`);
    return lines.join('\n');
}

/**
 * 格式化 host list 输出。
 *
 * @param config 解析后的 SSHConfig
 * @param resolveTarget Target 解析函数
 * @param json 是否输出 JSON 格式
 */
export function formatHostList(
    config: SSHConfig,
    resolveTarget: (target: string) => ResolvedHost,
    json: boolean,
): string {
    const hosts = getNamedHosts(config);
    if (json) {
        const items = hosts.map((target) => {
            try {
                const resolved = resolveTarget(target);
                return { target, host: resolved.host, port: resolved.port, user: resolved.username };
            } catch {
                return { target, host: '', port: 0, user: '' };
            }
        });
        return JSON.stringify(items);
    }
    const lines = hosts.map((target) => {
        try {
            const resolved = resolveTarget(target);
            return `${target}\t${resolved.host}:${resolved.port}\t${resolved.username}`;
        } catch {
            return `${target}\t(解析失败)`;
        }
    });
    return lines.join('\n');
}

/**
 * 格式化 host show 输出。
 *
 * @param target 目标名称
 * @param resolved 解析结果
 * @param json 是否输出 JSON 格式
 */
export function formatHostShow(target: string, resolved: ResolvedHost, json: boolean): string {
    if (json) {
        return JSON.stringify({ target, ...resolved });
    }
    const identity = resolved.identityFiles.length > 0 ? resolved.identityFiles.join(', ') : '(none)';
    return [
        `Target: ${target}`,
        '',
        `Host:     ${resolved.host}`,
        `Port:     ${resolved.port}`,
        `User:     ${resolved.username}`,
        `Identity: ${identity}`,
    ].join('\n');
}