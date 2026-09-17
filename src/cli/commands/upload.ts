import type { Command } from 'commander';
import type { Runtime } from '@/runtime/runtime';
import { formatTransferResult, formatTransferProgress } from '@/cli/renderer/format';
import { AitermError, getExitCode } from '@/errors/errors';

/**
 * 注册 `aiterm upload <target> <local-path> <remote-path>` 命令。
 *
 * 对应 CLI-Spec §3.7。流程：
 * 1. 加载 SSH Config
 * 2. 解析 Target → ResolvedHost
 * 3. Runtime.upload(host, local, remote, { recursive }) → TransferResult
 * 4. 按 --json 格式化输出
 *
 * --recursive 选项启用递归目录上传（纯 SFTP，无远程 Shell 依赖）。
 */
export function registerUploadCommand(program: Command, runtime: Runtime): void {
    program
        .command('upload')
        .description('上传文件到远程主机')
        .argument('<target>', '目标主机名称')
        .argument('<local>', '本地文件/目录路径')
        .argument('<remote>', '远程文件/目录路径')
        .option('-r, --recursive', '递归上传目录')
        .action(async (target: string, local: string, remote: string) => {
            const globalOpts = program.opts();
            const json = (globalOpts.json as boolean | undefined) ?? false;
            const configPath = globalOpts.config as string | undefined;

            const uploadCmd = program.commands.find((c) => c.name() === 'upload');
            const uploadOpts = uploadCmd?.opts() ?? {};
            const recursive = uploadOpts.recursive as boolean | undefined;

            try {
                const config = await runtime.loadConfig(configPath);
                const resolved = runtime.resolveTarget(config, target);

                const result = await runtime.upload(resolved, local, remote, {
                    recursive: recursive ?? false,
                    connectOptions: {},
                    onProgress: !json
                        ? (transferred: number, total: number) => {
                            const progress = formatTransferProgress(transferred, total);
                            process.stderr.write(`\r${progress}`);
                        }
                        : undefined,
                });

                if (!json) {
                    process.stderr.write('\n');
                }

                const formatted = formatTransferResult(result, 'upload', json);

                if (formatted.stdout) {
                    process.stdout.write(formatted.stdout);
                }
                if (formatted.stderr) {
                    process.stderr.write(formatted.stderr);
                }
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