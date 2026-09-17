import type { Command } from 'commander';
import type { Runtime } from '@/runtime/runtime';
import type { DirProgressInfo } from '@/ssh/transfer';
import { formatTransferResult, formatTransferProgress } from '@/cli/renderer/format';
import { AitermError, getExitCode } from '@/errors/errors';

/**
 * 注册 `aiterm download <target> <remote-path> <local-path>` 命令。
 *
 * 对应 CLI-Spec §3.7。流程：
 * 1. 加载 SSH Config
 * 2. 解析 Target → ResolvedHost
 * 3. Runtime.download(host, remote, local, { recursive }) → TransferResult
 * 4. 按 --json 格式化输出
 *
 * --recursive 选项启用递归目录下载（纯 SFTP，无远程 Shell 依赖）。
 */
export function registerDownloadCommand(program: Command, runtime: Runtime): void {
    program
        .command('download')
        .description('从远程主机下载文件')
        .argument('<target>', '目标主机名称')
        .argument('<remote>', '远程文件/目录路径')
        .argument('<local>', '本地文件/目录路径')
        .option('-r, --recursive', '递归下载目录')
        .action(async (target: string, remote: string, local: string) => {
            const globalOpts = program.opts();
            const json = (globalOpts.json as boolean | undefined) ?? false;
            const configPath = globalOpts.config as string | undefined;

            const downloadCmd = program.commands.find((c) => c.name() === 'download');
            const downloadOpts = downloadCmd?.opts() ?? {};
            const recursive = downloadOpts.recursive as boolean | undefined;

            try {
                const config = await runtime.loadConfig(configPath);
                const resolved = runtime.resolveTarget(config, target);

                let firstProgress = true;
                const result = await runtime.download(resolved, remote, local, {
                    recursive: recursive ?? false,
                    connectOptions: {},
                    onProgress: !json
                        ? (transferred: number, total: number, info?: DirProgressInfo) => {
                            const progress = formatTransferProgress(transferred, total, info);
                            if (firstProgress) {
                                process.stderr.write(progress);
                                firstProgress = false;
                            } else {
                                const lines = info ? 2 : 1;
                                process.stderr.write(`\x1b[${lines}A\r${progress}`);
                            }
                        }
                        : undefined,
                });

                if (!json) {
                    process.stderr.write('\n');
                }

                const formatted = formatTransferResult(result, 'download', json);

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