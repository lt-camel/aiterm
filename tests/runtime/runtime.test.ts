import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { Runtime } from '@/runtime/runtime';
import { parse } from '@/ssh-config/parser';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures', 'ssh-config');

describe('Runtime', () => {
    describe('loadConfig', () => {
        it('加载指定路径的配置', async () => {
            const runtime = new Runtime();
            const configPath = join(fixturesDir, 'basic.conf');
            const config = await runtime.loadConfig(configPath);
            expect(config.blocks).toHaveLength(1);
        });
    });

    describe('resolveTarget', () => {
        it('解析 Target 为 ResolvedHost', () => {
            const runtime = new Runtime();
            const config = parse(`
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
`);
            const resolved = runtime.resolveTarget(config, 'production');
            expect(resolved.host).toBe('192.168.1.100');
            expect(resolved.port).toBe(22);
            expect(resolved.username).toBe('root');
        });
    });

    describe('listHosts', () => {
        it('列出所有命名 Host', () => {
            const runtime = new Runtime();
            const config = parse(`
Host production
    HostName 192.168.1.100

Host staging
    HostName 10.0.0.20
`);
            const hosts = runtime.listHosts(config);
            expect(hosts).toEqual(['production', 'staging']);
        });
    });

    describe('checkConfig', () => {
        it('有效配置返回空列表', () => {
            const runtime = new Runtime();
            const config = parse(`
Host production
    HostName 192.168.1.100
`);
            const issues = runtime.checkConfig(config);
            expect(issues).toEqual([]);
        });

        it('缺少 HostName 报告问题', () => {
            const runtime = new Runtime();
            const config = parse(`
Host prod
    User deploy
`);
            const issues = runtime.checkConfig(config);
            expect(issues.length).toBeGreaterThan(0);
        });
    });
});