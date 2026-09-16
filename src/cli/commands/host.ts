import { Command } from 'commander';

import { Runtime } from '@/runtime/runtime';
import { formatHostList, formatHostShow } from '@/cli/renderer/format';

/**
 * `aiterm host` 命令组。
 *
 * 提供 host list 与 host show 两个子命令，
 * 对应 CLI-Spec §3.3–§3.4。
 *
 * @param program Commander 根命令
 * @param runtime Runtime 实例
 */
export function registerHostCommand(program: Command, runtime: Runtime): void {
    const hostCmd = program.command('host').description('SSH Host 管理');

    hostCmd
        .command('list')
        .description('列出所有 Host')
        .action(async () => {
            const opts = program.optsWithGlobals();
            const json = opts.json === true;
            const config = await runtime.loadConfig(opts.config as string | undefined);
            const output = formatHostList(
                config,
                (target) => runtime.resolveTarget(config, target),
                json,
            );
            process.stdout.write(output + '\n');
        });

    hostCmd
        .command('show')
        .description('显示 Host 解析结果')
        .argument('<target>', '目标 Host 名称')
        .action(async (target: string) => {
            const opts = program.optsWithGlobals();
            const json = opts.json === true;
            const config = await runtime.loadConfig(opts.config as string | undefined);
            const resolved = runtime.resolveTarget(config, target);
            const output = formatHostShow(target, resolved, json);
            process.stdout.write(output + '\n');
        });
}