import { describe, it, expect } from 'vitest';
import { createClient } from '@/ssh/transport';

describe('SSH Transport Adapter', () => {
    it('createClient 返回 ssh2 Client 实例', () => {
        const client = createClient();
        expect(client).toBeDefined();
        expect(typeof client.on).toBe('function');
        expect(typeof client.connect).toBe('function');
        expect(typeof client.end).toBe('function');
    });

    it('createClient 每次返回新实例', () => {
        const a = createClient();
        const b = createClient();
        expect(a).not.toBe(b);
    });
});