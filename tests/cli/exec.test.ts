import { describe, it, expect } from 'vitest';
import { formatExecResult } from '@/cli/renderer/format';
import type { ExecResult } from '@/ssh/exec';

describe('formatExecResult', () => {
    describe('人类格式', () => {
        it('成功命令原样输出 stdout', () => {
            const result: ExecResult = {
                stdout: 'Linux 5.15.0',
                stderr: '',
                exitCode: 0,
            };
            const formatted = formatExecResult(result, false);
            expect(formatted.stdout).toBe('Linux 5.15.0');
            expect(formatted.stderr).toBe('');
            expect(formatted.exitCode).toBe(0);
        });

        it('stderr 原样输出到 stderr', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: 'warning: something',
                exitCode: 0,
            };
            const formatted = formatExecResult(result, false);
            expect(formatted.stdout).toBe('');
            expect(formatted.stderr).toBe('warning: something');
        });

        it('exitCode 非零时在 stderr 追加提示', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: '',
                exitCode: 1,
            };
            const formatted = formatExecResult(result, false);
            expect(formatted.stderr).toContain('命令退出码: 1');
            expect(formatted.exitCode).toBe(1);
        });

        it('exitCode 非零且有 stderr 时追加换行再追加提示', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: 'error occurred',
                exitCode: 1,
            };
            const formatted = formatExecResult(result, false);
            expect(formatted.stderr).toContain('error occurred');
            expect(formatted.stderr).toContain('命令退出码: 1');
        });

        it('特殊字符原样传递', () => {
            const result: ExecResult = {
                stdout: "hello world\n'quoted' \"double\"",
                stderr: '',
                exitCode: 0,
            };
            const formatted = formatExecResult(result, false);
            expect(formatted.stdout).toBe("hello world\n'quoted' \"double\"");
        });
    });

    describe('JSON 格式', () => {
        it('输出完整 ExecResult JSON', () => {
            const result: ExecResult = {
                stdout: 'Linux 5.15.0',
                stderr: '',
                exitCode: 0,
            };
            const formatted = formatExecResult(result, true);
            const parsed = JSON.parse(formatted.stdout);
            expect(parsed.stdout).toBe('Linux 5.15.0');
            expect(parsed.stderr).toBe('');
            expect(parsed.exitCode).toBe(0);
        });

        it('JSON 格式包含 stderr 和 exitCode', () => {
            const result: ExecResult = {
                stdout: '',
                stderr: 'error: failed',
                exitCode: 1,
            };
            const formatted = formatExecResult(result, true);
            const parsed = JSON.parse(formatted.stdout);
            expect(parsed.stderr).toBe('error: failed');
            expect(parsed.exitCode).toBe(1);
        });

        it('JSON 格式 stderr 字段为空', () => {
            const result: ExecResult = {
                stdout: 'output',
                stderr: '',
                exitCode: 0,
            };
            const formatted = formatExecResult(result, true);
            expect(formatted.stderr).toBe('');
        });
    });
});