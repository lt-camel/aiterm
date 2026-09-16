import type { Command } from 'commander';
import type { Runtime } from '@/runtime/runtime';
import { getTerminalSize, attachTerminal } from '@/terminal/terminal';

/**
 * 注册 `aiterm ssh <target>` 命令。
 *
 * 对应 CLI-Spec §4。流程：
 * 1. 加载 SSH Config
 * 2. 解析 Target → ResolvedHost
 * 3. SSHClient.connect → SSHConnection
 * 4. 创建交互式 PTY 会话
 * 5. 双向绑定本地终端（含 escape 序列）
 * 6. 等待会话结束（远程退出 / escape 断开）
 *
 * @param program Commander 程序实例
 * @param runtime Runtime 实例
 */
export function registerSshCommand(program: Command, runtime: Runtime): void {
    program
        .command('ssh')
        .description('连接到远程主机')
        .argument('<target>', '目标主机名称')
        .action(async (target: string) => {
            const opts = program.optsWithGlobals();
            const json = opts.json as boolean | undefined;
            const configPath = opts.config as string | undefined;

            try {
                const config = await runtime.loadConfig(configPath);
                const resolved = runtime.resolveTarget(config, target);

                if (json) {
                    process.stdout.write(
                        JSON.stringify({
                            target,
                            host: resolved.host,
                            port: resolved.port,
                            username: resolved.username,
                            identityFiles: resolved.identityFiles,
                            status: 'connecting',
                        }) + '\n',
                    );
                }

                const size = getTerminalSize();

                const connection = await runtime.connect(resolved, {
                    onUnknownHost: async (fingerprint: string) => {
                        if (json) {
                            process.stdout.write(
                                JSON.stringify({
                                    event: 'known_hosts_unknown',
                                    fingerprint,
                                    message: '首次连接，主机密钥未记录',
                                }) + '\n',
                            );
                            return false;
                        }
                        process.stderr.write(
                            `\n首次连接 ${resolved.host}，主机密钥指纹:\n  SHA256:${fingerprint}\n是否信任? (y/N) `,
                        );
                        const answer = await readLine();
                        return answer.toLowerCase() === 'y';
                    },
                });

                const session = await connection.createSession({
                    cols: size.cols,
                    rows: size.rows,
                });

                const userInitiated = await attachTerminal(session);

                if (!json && userInitiated) {
                    process.stderr.write('\n连接已断开\n');
                }

                await connection.close();
            } catch (error) {
                if (json) {
                    const err =
                        error instanceof Error ? error : new Error(String(error));
                    process.stdout.write(
                        JSON.stringify({
                            error: {
                                code: (error as { code?: string }).code ?? 'INTERNAL_UNEXPECTED',
                                message: err.message,
                            },
                        }) + '\n',
                    );
                } else {
                    throw error;
                }
            }
        });
}

/**
 * 从 stdin 读取一行（用于 Known Hosts 确认）。
 */
function readLine(): Promise<string> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        const onData = (chunk: Buffer) => {
            chunks.push(chunk);
            const str = Buffer.concat(chunks).toString('utf-8');
            if (str.includes('\n') || str.includes('\r')) {
                process.stdin.removeListener('data', onData);
                resolve(str.replace(/[\r\n]/g, '').trim());
            }
        };
        process.stdin.on('data', onData);
    });
}