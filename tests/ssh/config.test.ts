import { describe, it, expect } from 'vitest';
import { buildConnectConfig } from '@/ssh/config';
import type { AuthCredentials } from '@/ssh/authentication';

describe('SSH Connect Config', () => {
    it('有 privateKey 时设置 tryKeyboard 回退', () => {
        const resolved = {
            host: '192.168.1.100',
            port: 2222,
            username: 'deploy',
            identityFiles: ['/home/user/.ssh/id_ed25519'],
        };
        const credentials: AuthCredentials = {
            username: 'deploy',
            privateKey: Buffer.from('fake-key'),
            tryKeyboard: true,
        };
        const config = buildConnectConfig(resolved, credentials);
        expect(config.host).toBe('192.168.1.100');
        expect(config.port).toBe(2222);
        expect(config.username).toBe('deploy');
        expect(config.privateKey).toBe(credentials.privateKey);
        expect(config.tryKeyboard).toBe(true);
    });

    it('有 agent 时设置 tryKeyboard 回退', () => {
        const resolved = {
            host: 'example.com',
            port: 22,
            username: 'root',
            identityFiles: [],
        };
        const credentials: AuthCredentials = {
            username: 'root',
            agent: 'pageant',
            tryKeyboard: true,
        };
        const config = buildConnectConfig(resolved, credentials);
        expect(config.readyTimeout).toBe(20_000);
        expect(config.agent).toBe('pageant');
        expect(config.tryKeyboard).toBe(true);
    });

    it('有 password 时设置 password 认证', () => {
        const resolved = {
            host: 'example.com',
            port: 22,
            username: 'root',
            identityFiles: [],
        };
        const credentials: AuthCredentials = {
            username: 'root',
            password: 'secret',
            tryKeyboard: true,
        };
        const config = buildConnectConfig(resolved, credentials);
        expect(config.password).toBe('secret');
        expect(config.tryKeyboard).toBe(true);
    });

    it('无凭据时仅设置 tryKeyboard', () => {
        const resolved = {
            host: 'example.com',
            port: 22,
            username: 'root',
            identityFiles: [],
        };
        const credentials: AuthCredentials = {
            username: 'root',
            tryKeyboard: true,
        };
        const config = buildConnectConfig(resolved, credentials);
        expect(config.host).toBe('example.com');
        expect(config.username).toBe('root');
        expect(config.privateKey).toBeUndefined();
        expect(config.agent).toBeUndefined();
        expect(config.password).toBeUndefined();
        expect(config.tryKeyboard).toBe(true);
    });
});