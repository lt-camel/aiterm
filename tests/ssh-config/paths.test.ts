import { describe, it, expect } from 'vitest';
import { getSshDir, getSshConfigPath, getKnownHostsPath, expandTilde } from '@/platform/paths';
import { homedir } from 'node:os';
import { join } from 'node:path';

describe('platform/paths', () => {
    describe('getSshDir', () => {
        it('返回 ~/.ssh 路径', () => {
            expect(getSshDir()).toBe(join(homedir(), '.ssh'));
        });
    });

    describe('getSshConfigPath', () => {
        it('返回 ~/.ssh/config 路径', () => {
            expect(getSshConfigPath()).toBe(join(homedir(), '.ssh', 'config'));
        });
    });

    describe('getKnownHostsPath', () => {
        it('返回 ~/.ssh/known_hosts 路径', () => {
            expect(getKnownHostsPath()).toBe(join(homedir(), '.ssh', 'known_hosts'));
        });
    });

    describe('expandTilde', () => {
        it('展开 ~ 为 home 目录', () => {
            expect(expandTilde('~')).toBe(homedir());
        });

        it('展开 ~/path 为 home 目录下路径', () => {
            expect(expandTilde('~/foo/bar')).toBe(join(homedir(), 'foo/bar'));
        });

        it('非 ~ 开头路径原样返回', () => {
            expect(expandTilde('/absolute/path')).toBe('/absolute/path');
            expect(expandTilde('relative/path')).toBe('relative/path');
        });
    });
});