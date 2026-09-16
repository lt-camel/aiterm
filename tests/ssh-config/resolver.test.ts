import { describe, it, expect } from 'vitest';
import { resolve } from '@/ssh-config/resolver';
import { parse } from '@/ssh-config/parser';
import type { SSHConfig } from '@/ssh-config/model';

describe('Resolver', () => {
    describe('resolve', () => {
        it('将 Target 解析为 ResolvedHost', () => {
            const config = parse(`
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
`);
            const resolved = resolve(config, 'production');
            expect(resolved.host).toBe('192.168.1.100');
            expect(resolved.port).toBe(22);
            expect(resolved.username).toBe('root');
            expect(resolved.identityFiles.length).toBeGreaterThan(0);
        });

        it('展开 ~ 为 home 目录', () => {
            const config = parse(`
Host production
    HostName 192.168.1.100
    IdentityFile ~/.ssh/id_ed25519
`);
            const resolved = resolve(config, 'production');
            expect(resolved.identityFiles[0]).toBeDefined();
            expect(resolved.identityFiles[0]!.startsWith('~')).toBe(false);
            expect(resolved.identityFiles[0]!).toContain('id_ed25519');
        });

        it('缺失指令使用默认值', () => {
            const config = parse(`
Host minimal
    HostName 10.0.0.1
`);
            const resolved = resolve(config, 'minimal');
            expect(resolved.port).toBe(22);
            expect(resolved.identityFiles).toEqual([]);
        });

        it('HostName 缺省时使用 Target 作为主机名', () => {
            const config = parse(`
Host myserver
    User deploy
`);
            const resolved = resolve(config, 'myserver');
            expect(resolved.host).toBe('myserver');
        });

        it('多 IdentityFile 全部展开', () => {
            const config = parse(`
Host multi
    HostName 10.0.0.1
    IdentityFile ~/.ssh/id_rsa
    IdentityFile ~/.ssh/id_ed25519
`);
            const resolved = resolve(config, 'multi');
            expect(resolved.identityFiles).toHaveLength(2);
        });

        it('未知 Target 抛出 ConfigError', () => {
            const config: SSHConfig = { blocks: [] };
            expect(() => resolve(config, 'nonexistent')).toThrow('未找到 Host 配置');
        });

        it('按文件顺序匹配首个 Host 块', () => {
            const config = parse(`
Host shared
    HostName 10.0.0.1
    User first

Host shared
    HostName 10.0.0.2
    User second
`);
            const resolved = resolve(config, 'shared');
            expect(resolved.host).toBe('10.0.0.1');
            expect(resolved.username).toBe('first');
        });
    });
});