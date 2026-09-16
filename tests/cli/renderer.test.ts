import { describe, it, expect } from 'vitest';
import { formatConfigPath, formatConfigCheck, formatHostShow } from '@/cli/renderer/format';
import type { ResolvedHost } from '@/ssh-config/model';

describe('Renderer', () => {
    describe('formatConfigPath', () => {
        it('人类格式输出路径', () => {
            expect(formatConfigPath('/home/user/.ssh/config', false)).toBe(
                '/home/user/.ssh/config',
            );
        });

        it('JSON 格式输出', () => {
            const result = JSON.parse(formatConfigPath('/home/user/.ssh/config', true));
            expect(result.path).toBe('/home/user/.ssh/config');
        });
    });

    describe('formatConfigCheck', () => {
        it('无问题时输出 OK', () => {
            expect(formatConfigCheck([], false)).toBe('✓ Config syntax OK');
        });

        it('有问题时列出问题', () => {
            const issues = [{ host: 'prod', problem: 'missing HostName' }];
            expect(formatConfigCheck(issues, false)).toBe("✗ Host 'prod' missing HostName");
        });

        it('JSON 格式输出', () => {
            const result = JSON.parse(formatConfigCheck([], true));
            expect(result.ok).toBe(true);
            expect(result.issues).toEqual([]);
        });
    });

    describe('formatHostShow', () => {
        it('人类格式输出 ResolvedHost', () => {
            const resolved: ResolvedHost = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                identityFiles: ['/home/user/.ssh/id_ed25519'],
            };
            const output = formatHostShow('production', resolved, false);
            expect(output).toContain('Target: production');
            expect(output).toContain('Host:     192.168.1.100');
            expect(output).toContain('Port:     22');
            expect(output).toContain('User:     root');
        });

        it('JSON 格式输出', () => {
            const resolved: ResolvedHost = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                identityFiles: [],
            };
            const result = JSON.parse(formatHostShow('production', resolved, true));
            expect(result.target).toBe('production');
            expect(result.host).toBe('192.168.1.100');
            expect(result.port).toBe(22);
        });
    });
});