import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { load, check } from '@/ssh-config/loader';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures', 'ssh-config');

describe('Loader', () => {
    describe('load', () => {
        it('加载并解析 SSH Config 文件', async () => {
            const configPath = join(fixturesDir, 'basic.conf');
            const config = await load(configPath);
            expect(config.blocks).toHaveLength(1);
            expect(config.blocks[0]!.patterns).toEqual(['production']);
        });

        it('加载多 Host 配置文件', async () => {
            const configPath = join(fixturesDir, 'multi-host.conf');
            const config = await load(configPath);
            expect(config.blocks.length).toBeGreaterThanOrEqual(2);
        });

        it('文件不存在时抛出 ConfigError', async () => {
            await expect(load('/nonexistent/config')).rejects.toThrow('SSH Config 文件不存在');
        });
    });

    describe('check', () => {
        it('有效配置返回空问题列表', async () => {
            const configPath = join(fixturesDir, 'basic.conf');
            const config = await load(configPath);
            const issues = check(config);
            expect(issues).toEqual([]);
        });

        it('缺少 HostName 的块报告问题', async () => {
            const configPath = join(fixturesDir, 'missing-hostname.conf');
            const config = await load(configPath);
            const issues = check(config);
            expect(issues.length).toBeGreaterThan(0);
            expect(issues[0]!.problem).toBe('missing HostName');
        });
    });
});