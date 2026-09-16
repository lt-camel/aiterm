import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPrivateKey, buildCredentials, detectAgent } from '@/ssh/authentication';

const tmpDir = join(process.env.TEMP ?? '/tmp', 'aiterm-test-auth');

describe('Authentication', () => {
    beforeEach(async () => {
        await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    describe('loadPrivateKey', () => {
        it('空列表返回 undefined', async () => {
            const result = await loadPrivateKey([]);
            expect(result).toBeUndefined();
        });

        it('不存在的路径返回 undefined', async () => {
            const path = join(tmpDir, 'nonexistent-key');
            const result = await loadPrivateKey([path]);
            expect(result).toBeUndefined();
        });

        it('成功读取私钥文件', async () => {
            const keyPath = join(tmpDir, 'test-key');
            const keyContent = Buffer.from('fake-private-key-content');
            await writeFile(keyPath, keyContent);
            const result = await loadPrivateKey([keyPath]);
            expect(result).toBeDefined();
            expect(result!.equals(keyContent)).toBe(true);
        });

        it('多个路径时跳过不存在的，读取第一个有效的', async () => {
            const badPath = join(tmpDir, 'nonexistent');
            const goodPath = join(tmpDir, 'good-key');
            const keyContent = Buffer.from('good-key-content');
            await writeFile(goodPath, keyContent);
            const result = await loadPrivateKey([badPath, goodPath]);
            expect(result).toBeDefined();
            expect(result!.equals(keyContent)).toBe(true);
        });
    });

    describe('buildCredentials', () => {
        it('有 IdentityFile 时返回私钥凭据', async () => {
            const keyPath = join(tmpDir, 'cred-key');
            const keyContent = Buffer.from('credential-key');
            await writeFile(keyPath, keyContent);
            const resolved = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                identityFiles: [keyPath],
            };
            const creds = await buildCredentials(resolved);
            expect(creds.username).toBe('root');
            expect(creds.privateKey).toBeDefined();
            expect(creds.privateKey!.equals(keyContent)).toBe(true);
        });

        it('无 IdentityFile 时回退到 Agent', async () => {
            const resolved = {
                host: '192.168.1.100',
                port: 22,
                username: 'root',
                identityFiles: [],
            };
            const creds = await buildCredentials(resolved);
            expect(creds.username).toBe('root');
            expect(creds.privateKey).toBeUndefined();
        });
    });

    describe('detectAgent', () => {
        it('Windows 返回 pageant', () => {
            if (process.platform === 'win32') {
                expect(detectAgent()).toBe('pageant');
            }
        });
    });
});