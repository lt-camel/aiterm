import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
    verifyKnownHosts,
    appendToKnownHosts,
    computeFingerprint,
    KnownHostsStatus,
} from '@/ssh/known-hosts';

const tmpDir = join(process.env.TEMP ?? '/tmp', 'aiterm-test-known-hosts');

describe('Known Hosts', () => {
    beforeEach(async () => {
        await mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    describe('computeFingerprint', () => {
        it('计算 SHA256 指纹', () => {
            const key = Buffer.from('test-key-data');
            const fp = computeFingerprint(key);
            expect(fp).toBeDefined();
            expect(typeof fp).toBe('string');
            expect(fp.length).toBeGreaterThan(0);
            expect(fp).not.toContain('=');
        });

        it('相同输入产生相同指纹', () => {
            const key = Buffer.from('same-key');
            expect(computeFingerprint(key)).toBe(computeFingerprint(key));
        });

        it('不同输入产生不同指纹', () => {
            const a = Buffer.from('key-a');
            const b = Buffer.from('key-b');
            expect(computeFingerprint(a)).not.toBe(computeFingerprint(b));
        });
    });

    describe('verifyKnownHosts', () => {
        it('known_hosts 不存在时返回 Unknown', async () => {
            const knownHostsPath = join(tmpDir, 'nonexistent');
            const key = Buffer.from('host-key');
            const result = await verifyKnownHosts('example.com', 22, key, knownHostsPath);
            expect(result.status).toBe(KnownHostsStatus.Unknown);
            expect(result.fingerprint).toBeDefined();
        });

        it('known_hosts 中无匹配条目时返回 Unknown', async () => {
            const knownHostsPath = join(tmpDir, 'known_hosts');
            await writeFile(knownHostsPath, 'otherhost ssh-ed25519 AAAA==\n', 'utf-8');
            const key = Buffer.from('host-key');
            const result = await verifyKnownHosts('example.com', 22, key, knownHostsPath);
            expect(result.status).toBe(KnownHostsStatus.Unknown);
        });

        it('known_hosts 中有匹配密钥时返回 Match', async () => {
            const key = Buffer.from('host-key');
            const keyBase64 = key.toString('base64');
            const knownHostsPath = join(tmpDir, 'known_hosts');
            await writeFile(knownHostsPath, `example.com ssh-ed25519 ${keyBase64}\n`, 'utf-8');
            const result = await verifyKnownHosts('example.com', 22, key, knownHostsPath);
            expect(result.status).toBe(KnownHostsStatus.Match);
        });

        it('known_hosts 中密钥不匹配时返回 Mismatch', async () => {
            const storedKey = Buffer.from('stored-key');
            const remoteKey = Buffer.from('remote-key');
            const storedBase64 = storedKey.toString('base64');
            const knownHostsPath = join(tmpDir, 'known_hosts');
            await writeFile(knownHostsPath, `example.com ssh-ed25519 ${storedBase64}\n`, 'utf-8');
            const result = await verifyKnownHosts('example.com', 22, remoteKey, knownHostsPath);
            expect(result.status).toBe(KnownHostsStatus.Mismatch);
            expect(result.fingerprint).toBeDefined();
        });

        it('非标准端口使用 [host]:port 格式匹配', async () => {
            const key = Buffer.from('host-key');
            const keyBase64 = key.toString('base64');
            const knownHostsPath = join(tmpDir, 'known_hosts');
            await writeFile(knownHostsPath, `[example.com]:2222 ssh-ed25519 ${keyBase64}\n`, 'utf-8');
            const result = await verifyKnownHosts('example.com', 2222, key, knownHostsPath);
            expect(result.status).toBe(KnownHostsStatus.Match);
        });
    });

    describe('appendToKnownHosts', () => {
        it('追加条目到 known_hosts 文件', async () => {
            const knownHostsPath = join(tmpDir, 'known_hosts');
            const key = Buffer.from('new-host-key');
            await appendToKnownHosts('newhost.com', 22, key, 'ssh-ed25519', knownHostsPath);
            const { readFile } = await import('node:fs/promises');
            const content = await readFile(knownHostsPath, 'utf-8');
            expect(content).toContain('newhost.com');
            expect(content).toContain(key.toString('base64'));
        });

        it('非标准端口使用 [host]:port 格式', async () => {
            const knownHostsPath = join(tmpDir, 'known_hosts');
            const key = Buffer.from('port-key');
            await appendToKnownHosts('porthost.com', 2222, key, 'ssh-ed25519', knownHostsPath);
            const { readFile } = await import('node:fs/promises');
            const content = await readFile(knownHostsPath, 'utf-8');
            expect(content).toContain('[porthost.com]:2222');
        });
    });
});