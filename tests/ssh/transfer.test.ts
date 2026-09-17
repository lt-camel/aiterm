import { describe, it, expect } from 'vitest';
import { formatTransferProgress, formatTransferResult, formatBytes } from '@/cli/renderer/format';
import type { TransferResult } from '@/ssh/transfer';

describe('formatBytes', () => {
    it('formats bytes', () => {
        expect(formatBytes(0)).toBe('0B');
        expect(formatBytes(512)).toBe('512B');
    });

    it('formats kilobytes', () => {
        expect(formatBytes(1024)).toBe('1.0KB');
        expect(formatBytes(1536)).toBe('1.5KB');
    });

    it('formats megabytes', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.0MB');
        expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5MB');
    });

    it('formats gigabytes', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0GB');
    });
});

describe('formatTransferProgress', () => {
    it('shows 0% at start', () => {
        const result = formatTransferProgress(0, 1000);
        expect(result).toContain('0%');
        expect(result).toContain('0B/1000B');
    });

    it('shows 100% at end', () => {
        const result = formatTransferProgress(1000, 1000);
        expect(result).toContain('100%');
    });

    it('shows intermediate progress', () => {
        const result = formatTransferProgress(500, 1000);
        expect(result).toContain('50%');
    });

    it('handles zero total', () => {
        const result = formatTransferProgress(0, 0);
        expect(result).toContain('0%');
    });
});

describe('formatTransferResult', () => {
    const result: TransferResult = {
        bytes: 1258291,
        local: './app.exe',
        remote: '/tmp/app.exe',
    };

    it('formats upload in human format', () => {
        const formatted = formatTransferResult(result, 'upload', false);
        expect(formatted.stdout).toContain('uploaded');
        expect(formatted.stdout).toContain('./app.exe');
        expect(formatted.stdout).toContain('/tmp/app.exe');
        expect(formatted.stdout).toContain('→');
        expect(formatted.stderr).toBe('');
    });

    it('formats download in human format', () => {
        const formatted = formatTransferResult(result, 'download', false);
        expect(formatted.stdout).toContain('downloaded');
        expect(formatted.stdout).toContain('←');
    });

    it('formats upload in JSON format', () => {
        const formatted = formatTransferResult(result, 'upload', true);
        const parsed = JSON.parse(formatted.stdout);
        expect(parsed.ok).toBe(true);
        expect(parsed.bytes).toBe(1258291);
        expect(parsed.local).toBe('./app.exe');
        expect(parsed.remote).toBe('/tmp/app.exe');
    });

    it('formats download in JSON format', () => {
        const formatted = formatTransferResult(result, 'download', true);
        const parsed = JSON.parse(formatted.stdout);
        expect(parsed.ok).toBe(true);
        expect(parsed.bytes).toBe(1258291);
    });
});