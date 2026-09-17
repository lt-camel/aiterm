import { Command } from 'commander';

import packageJson from '../package.json';
import { AitermError, getExitCode, InternalError } from '@/errors/errors';
import { Runtime } from '@/runtime/runtime';
import { registerConfigCommand } from '@/cli/commands/config';
import { registerHostCommand } from '@/cli/commands/host';
import { registerSshCommand } from '@/cli/commands/ssh';
import { registerExecCommand } from '@/cli/commands/exec';

const program = new Command();
const runtime = new Runtime();

program
    .name('aiterm')
    .description('AI-Native 本地 SSH Remote Terminal Runtime')
    .version(packageJson.version)
    .option('--json', '输出 JSON 格式（供 AI/脚本解析）')
    .option('--config <path>', '指定 SSH Config 路径')
    .option('--debug', '输出调试日志');

registerConfigCommand(program, runtime);
registerHostCommand(program, runtime);
registerSshCommand(program, runtime);
registerExecCommand(program, runtime);

program.parseAsync().catch((error: unknown) => {
    const aitermError =
        error instanceof AitermError
            ? error
            : new InternalError(error instanceof Error ? error.message : String(error));
    process.stderr.write(`✗ ${aitermError.message}\n  提示：${aitermError.hint}\n`);
    process.exit(getExitCode(aitermError));
});