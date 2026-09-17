import type { ResolvedHost } from '@/ssh-config/model';
import type { SSHConfig } from '@/ssh-config/model';
import type { ExecResult } from '@/ssh/exec';
import type { TransferResult, DirProgressInfo } from '@/ssh/transfer';
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

/**
 * 格式化 exec 命令输出。
 *
 * 对应 CLI-Spec §3.6。
 * - 人类格式：stdout 原样输出到 stdout，stderr 原样输出到 stderr，
 *   exitCode 非零时在 stderr 追加提示
 * - JSON 格式：{ stdout, stderr, exitCode }
 *
 * @param result 远程命令执行结果
 * @param json 是否输出 JSON 格式
 * @returns 格式化后的输出（人类格式分别返回 stdout/stderr/exitCode，
 *          JSON 格式在 stdout 字段返回完整 JSON 字符串）
 */
export function formatExecResult(result: ExecResult, json: boolean): {
    stdout: string;
    stderr: string;
    exitCode: number;
} {
    if (json) {
        return {
            stdout: JSON.stringify(result),
            stderr: '',
            exitCode: result.exitCode,
        };
    }
    let stderr = result.stderr;
    if (result.exitCode !== 0 && !stderr.endsWith('\n') && stderr.length > 0) {
        stderr += '\n';
    }
    if (result.exitCode !== 0) {
        stderr += `✗ 命令退出码: ${result.exitCode}\n`;
    }
    return {
        stdout: result.stdout,
        stderr,
        exitCode: result.exitCode,
    };
}

/**
 * 人类可读的字节数格式化。
 *
 * @param bytes 字节数
 * @returns 格式化字符串，如 "1.2MB"、"345KB"
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

/**
 * 格式化传输进度条。
 *
 * 单文件（info 为 undefined）：
 *   [=========>          ] 45%  4.5MB/10MB
 *
 * 目录传输（info 存在），双行：
 *   subdir/file2.txt  9KB/20KB
 *   [====================>                   ] 50%  2/5 files
 *
 * @param transferred 已传输字节数（目录场景为整体已传）
 * @param total 总字节数（目录场景为目录总量）
 * @param info 目录进度信息，仅递归传输时提供
 * @returns 进度字符串（不含换行，目录场景含 \n 分隔双行）
 */
export function formatTransferProgress(transferred: number, total: number, info?: DirProgressInfo): string {
    if (!info) {
        const width = 40;
        const ratio = total > 0 ? transferred / total : 0;
        const percent = Math.floor(ratio * 100);
        const filled = Math.floor(ratio * width);
        const bar = '='.repeat(filled) + (filled < width ? '>' : '');
        const padding = ' '.repeat(Math.max(0, width - filled - 1));

        return `[${bar}${padding}] ${percent}%  ${formatBytes(transferred)}/${formatBytes(total)}`;
    }

    const line2Width = 40;
    const ratio = total > 0 ? transferred / total : 0;
    const percent = Math.floor(ratio * 100);
    const filled = Math.floor(ratio * line2Width);
    const bar = '='.repeat(filled) + (filled < line2Width ? '>' : '');
    const padding = ' '.repeat(Math.max(0, line2Width - filled - 1));

    const sizeInfo = `${formatBytes(info.fileTransferred)}/${formatBytes(info.fileTotal)}`;
    const maxLineWidth = 80;
    const line2Prefix = `[${bar}${padding}] ${percent}%  ${formatBytes(transferred)}/${formatBytes(total)}  ${info.fileIndex}/${info.fileCount} files`;
    const maxFileNameLen = Math.max(0, maxLineWidth - sizeInfo.length - 2);
    const displayName = info.currentFile.length > maxFileNameLen
        ? info.currentFile.slice(0, maxFileNameLen - 1) + '…'
        : info.currentFile;

    const line1 = `${displayName}  ${sizeInfo}`;
    const line2 = line2Prefix;

    return `${line1}\n${line2}`;
}

/**
 * 格式化传输结果输出。
 *
 * 对应 CLI-Spec §3.7。
 * - 人类格式：✓ uploaded ./app.exe → /tmp/app.exe  (1.2MB)
 * - JSON 格式：{ "ok": true, "bytes": 1258291, "local": "...", "remote": "..." }
 *
 * @param result 传输结果
 * @param direction 传输方向
 * @param json 是否输出 JSON 格式
 */
export function formatTransferResult(
    result: TransferResult,
    direction: 'upload' | 'download',
    json: boolean,
): { stdout: string; stderr: string } {
    if (json) {
        return {
            stdout: JSON.stringify({ ok: true, bytes: result.bytes, local: result.local, remote: result.remote }),
            stderr: '',
        };
    }

    const arrow = direction === 'upload' ? '→' : '←';
    const verb = direction === 'upload' ? 'uploaded' : 'downloaded';
    const size = formatBytes(result.bytes);

    return {
        stdout: `✓ ${verb} ${result.local} ${arrow} ${result.remote}  (${size})\n`,
        stderr: '',
    };
}