import { describe, it, expect } from 'vitest';
import { getTerminalSize } from '@/terminal/terminal';
import { createPTYOptions } from '@/terminal/pty';

describe('Terminal', () => {
    describe('getTerminalSize', () => {
        it('返回 cols 和 rows', () => {
            const size = getTerminalSize();
            expect(size).toHaveProperty('cols');
            expect(size).toHaveProperty('rows');
            expect(size.cols).toBeGreaterThan(0);
            expect(size.rows).toBeGreaterThan(0);
        });
    });

    describe('createPTYOptions', () => {
        it('默认值', () => {
            const opts = createPTYOptions();
            expect(opts.term).toBe('xterm-256color');
            expect(opts.cols).toBe(80);
            expect(opts.rows).toBe(24);
        });

        it('合并用户选项', () => {
            const opts = createPTYOptions({ term: 'xterm', cols: 120, rows: 40 });
            expect(opts.term).toBe('xterm');
            expect(opts.cols).toBe(120);
            expect(opts.rows).toBe(40);
        });

        it('部分覆盖', () => {
            const opts = createPTYOptions({ cols: 100 });
            expect(opts.term).toBe('xterm-256color');
            expect(opts.cols).toBe(100);
            expect(opts.rows).toBe(24);
        });
    });
});