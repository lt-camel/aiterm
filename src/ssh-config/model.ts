/**
 * SSH Config 数据模型。
 *
 * 定义 HostBlock、SSHConfig、ResolvedHost 等核心类型，
 * 对应架构文档 §7–§9。
 *
 * @example
 * ```ts
 * const block: HostBlock = {
 *   patterns: ['production'],
 *   directives: new Map([
 *     ['HostName', ['192.168.1.100']],
 *     ['User', ['root']],
 *     ['Port', ['22']],
 *   ]),
 * };
 * ```
 */

export interface HostBlock {
    /** Host 行的模式列表，如 ['production'] 或 ['dev', 'staging'] */
    patterns: string[];
    /** 指令名 → 值列表（支持多值指令如 IdentityFile） */
    directives: Map<string, string[]>;
}

export interface SSHConfig {
    /** 按文件顺序排列的所有 Host 块 */
    blocks: HostBlock[];
}

export interface ResolvedHost {
    /** 目标主机名或 IP（来自 HostName 指令，缺省取 Host pattern） */
    host: string;
    /** SSH 端口，默认 22 */
    port: number;
    /** 登录用户名 */
    username: string;
    /** 身份文件路径列表（已展开 ~） */
    identityFiles: string[];
}

/** SSH Config 第一阶段支持的指令集 */
export const SUPPORTED_DIRECTIVES = [
    'Host',
    'HostName',
    'User',
    'Port',
    'IdentityFile',
] as const;

export type SupportedDirective = (typeof SUPPORTED_DIRECTIVES)[number];

/** 默认 SSH 端口 */
export const DEFAULT_SSH_PORT = 22;

/** 默认 SSH 用户名（当前系统用户） */
export function getDefaultUsername(): string {
    return process.env.USER ?? process.env.USERNAME ?? 'root';
}