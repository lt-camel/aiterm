import { describe, it, expect } from 'vitest';
import type { ExecResult, ExecOptions } from '@/ssh/exec';

describe('Exec 类型', () => {
    describe('ExecResult', () => {
        it('包含 stdout/stderr/exitCode 字段', () => {
            const result: ExecResult = {
                stdout: 'Linux 5.15.0',
                stderr: '',
                exitCode: 0,
            };
            expect(result.stdout).toBe('Linux 5.15.0');
            expect(result.stderr).toBe('');
            expect(result.exitCode).toBe(0);
        });

        it('命令失败时 exitCode 非 0', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: 'command not found',
                exitCode: 127,
            };
            expect(result.exitCode).not.toBe(0);
            expect(result.stderr).toContain('not found');
        });

        it('stderr 内容正确返回', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: 'error: permission denied',
                exitCode: 1,
            };
            expect(result.stderr).toBe('error: permission denied');
        });
    });

    describe('ExecOptions', () => {
        it('timeout 为可选字段', () => {
            const opts: ExecOptions = {};
            expect(opts.timeout).toBeUndefined();
        });

        it('可设置超时值', () => {
            const opts: ExecOptions = { timeout: 5000 };
            expect(opts.timeout).toBe(5000);
        });
    });
});