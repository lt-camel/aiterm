import { Command } from 'commander';

import packageJson from '../package.json';
import { AitermError, getExitCode, InternalError } from '@/errors/errors';

const program = new Command();

program
    .name('aiterm')
    .description('AI-Native 本地 SSH Remote Terminal Runtime')
    .version(packageJson.version)
    .option('--json', '输出 JSON 格式（供 AI/脚本解析）')
    .option('--config <path>', '指定 SSH Config 路径')
    .option('--debug', '输出调试日志');

program.parseAsync().catch((error: unknown) => {
    const aitermError =
        error instanceof AitermError
            ? error
            : new InternalError(error instanceof Error ? error.message : String(error));
    process.stderr.write(`✗ ${aitermError.message}\n  提示：${aitermError.hint}\n`);
    process.exit(getExitCode(aitermError));
});