import { describe, it, expect } from 'vitest';
import { buildConnectConfig } from '@/ssh/config';

describe('SSH Connect Config', () => {
    it('从 ResolvedHost 构建配置', () => {
        const resolved = {
            host: '192.168.1.100',
            port: 2222,
            username: 'deploy',
            identityFiles: ['/home/user/.ssh/id_ed25519'],
        };
        const privateKey = Buffer.from('fake-key');
        const config = buildConnectConfig(resolved, privateKey);
        expect(config.host).toBe('192.168.1.100');
        expect(config.port).toBe(2222);
        expect(config.username).toBe('deploy');
        expect(config.privateKey).toBe(privateKey);
    });

    it('默认 readyTimeout 为 20 秒', () => {
        const resolved = {
            host: 'example.com',
            port: 22,
            username: 'root',
            identityFiles: [],
        };
        const config = buildConnectConfig(resolved, Buffer.from('key'));
        expect(config.readyTimeout).toBe(20_000);
    });
});