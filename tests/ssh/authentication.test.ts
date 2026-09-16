import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPrivateKey, buildCredentials } from '@/ssh/authentication';
import { AuthError } from '@/errors/errors';

const tmpDir = join(process.env.TEMP ?? '/tmp', 'aiterm-test-auth');

describe('Authentication', () => {
    beforeEach(async () => {
        await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    describe('loadPrivateKey', () => {
        it('空列表抛 AUTH_KEY_NOT_FOUND', async () => {
            await expect(loadPrivateKey([])).rejects.toThrow(AuthError);
            try {
                await loadPrivateKey([]);
            } catch (e) {
                expect((e as AuthError).code).toBe('AUTH_KEY_NOT_FOUND');
            }
        });

        it('不存在的路径抛 AUTH_KEY_NOT_FOUND', async () => {
            const path = join(tmpDir, 'nonexistent-key');
            await expect(loadPrivateKey([path])).rejects.toThrow(AuthError);
        });

        it('成功读取私钥文件', async () => {
            const keyPath = join(tmpDir, 'test-key');
            const keyContent = Buffer.from('fake-private-key-content');
            await writeFile(keyPath, keyContent);
            const result = await loadPrivateKey([keyPath]);
            expect(result).toBeDefined();
            expect(result.equals(keyContent)).toBe(true);
        });

        it('多个路径时跳过不存在的，读取第一个有效的', async () => {
            const badPath = join(tmpDir, 'nonexistent');
            const goodPath = join(tmpDir, 'good-key');
            const keyContent = Buffer.from('good-key-content');
            await writeFile(goodPath, keyContent);
            const result = await loadPrivateKey([badPath, goodPath]);
            expect(result.equals(keyContent)).toBe(true);
        });
    });

    describe('buildCredentials', () => {
        it('从 ResolvedHost 构建凭据', async () => {
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
            expect(creds.privateKey.equals(keyContent)).toBe(true);
        });
    });
});