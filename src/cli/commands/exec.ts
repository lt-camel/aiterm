import type { Command } from 'commander';
import type { Runtime } from '@/runtime/runtime';
import { formatExecResult } from '@/cli/renderer/format';
import { AitermError, getExitCode } from '@/errors/errors';

/**
 * 注册 `aiterm exec <target> -- <command...>` 命令。
 *
 * 对应 CLI-Spec §3.6。流程：
 * 1. 加载 SSH Config
 * 2. 解析 Target → ResolvedHost
 * 3. Runtime.exec(host, command, { timeout }) → ExecResult
 * 4. 按 --json 格式化输出
 * 5. 退出码 = 远程命令退出码
 *
 * 命令通过 `--` 分隔，commander 将 `--` 后的参数原样传递，
 * 不在本地解析，对应验收 A3.9（特殊字符正确传递）。
 */
export function registerExecCommand(program: Command, runtime: Runtime): void {
    program
        .command('exec')
        .description('执行远程命令')
        .argument('<target>', '目标主机名称')
        .argument('<command...>', '远程命令（使用 -- 分隔）')
        .option('--timeout <ms>', '命令执行超时（毫秒）', parseInt)
        .action(async (target: string, commandParts: string[]) => {
            const globalOpts = program.opts();
            const json = (globalOpts.json as boolean | undefined) ?? false;
            const configPath = globalOpts.config as string | undefined;

            const execCmd = program.commands.find((c) => c.name() === 'exec');
            const execOpts = execCmd?.opts() ?? {};
            const timeout = execOpts.timeout as number | undefined;

            const command = commandParts.join(' ');

            try {
                const config = await runtime.loadConfig(configPath);
                const resolved = runtime.resolveTarget(config, target);

                const result = await runtime.exec(resolved, command, {
                    timeout: timeout && timeout > 0 ? timeout : undefined,
                });

                const formatted = formatExecResult(result, json);

                if (formatted.stdout) {
                    process.stdout.write(formatted.stdout);
                    if (!json && !formatted.stdout.endsWith('\n')) {
                        process.stdout.write('\n');
                    }
                }
                if (formatted.stderr) {
                    process.stderr.write(formatted.stderr);
                }

                process.exit(formatted.exitCode);
            } catch (error) {
                if (json) {
                    const err = error instanceof AitermError
                        ? error
                        : new Error(error instanceof Error ? error.message : String(error));
                    const code = error instanceof AitermError ? error.code : 'INTERNAL_UNEXPECTED';
                    const hint = error instanceof AitermError ? error.hint : '';
                    process.stdout.write(
                        JSON.stringify({
                            error: { code, message: err.message, hint },
                        }) + '\n',
                    );
                    process.exit(error instanceof AitermError ? getExitCode(error) : 1);
                } else {
                    throw error;
                }
            }
        });
}