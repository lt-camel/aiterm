import { Command } from 'commander';

import { Runtime } from '@/runtime/runtime';
import { getSshConfigPath } from '@/platform/paths';
import { formatConfigPath, formatConfigCheck } from '@/cli/renderer/format';

/**
 * `aiterm config` 命令组。
 *
 * 提供 config path 与 config check 两个子命令，
 * 对应 CLI-Spec §3.1–§3.2。
 *
 * @param program Commander 根命令
 * @param runtime Runtime 实例
 */
export function registerConfigCommand(program: Command, runtime: Runtime): void {
    const configCmd = program.command('config').description('SSH Config 管理');

    configCmd
        .command('path')
        .description('显示 SSH Config 文件路径')
        .action(async () => {
            const opts = program.optsWithGlobals();
            const json = opts.json === true;
            const configPath: string = opts.config ?? getSshConfigPath();
            process.stdout.write(formatConfigPath(configPath, json) + '\n');
        });

    configCmd
        .command('check')
        .description('检查 SSH Config 有效性')
        .action(async () => {
            const opts = program.optsWithGlobals();
            const json = opts.json === true;
            const config = await runtime.loadConfig(opts.config as string | undefined);
            const issues = runtime.checkConfig(config);
            const output = formatConfigCheck(issues, json);
            process.stdout.write(output + '\n');
            if (issues.length > 0) {
                process.exit(2);
            }
        });
}