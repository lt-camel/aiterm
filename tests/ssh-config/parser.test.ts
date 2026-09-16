import { describe, it, expect } from 'vitest';
import { parse, getNamedHosts } from '@/ssh-config/parser';

describe('Parser', () => {
    describe('parse', () => {
        it('解析单 Host 块', () => {
            const text = `
Host production
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519
`;
            const config = parse(text);
            expect(config.blocks).toHaveLength(1);
            expect(config.blocks[0]!.patterns).toEqual(['production']);
            expect(config.blocks[0]!.directives.get('HostName')).toEqual(['192.168.1.100']);
            expect(config.blocks[0]!.directives.get('User')).toEqual(['root']);
            expect(config.blocks[0]!.directives.get('Port')).toEqual(['22']);
            expect(config.blocks[0]!.directives.get('IdentityFile')).toEqual(['~/.ssh/id_ed25519']);
        });

        it('解析多 Host 块', () => {
            const text = `
Host production
    HostName 192.168.1.100
    User root

Host staging
    HostName 10.0.0.20
    User deploy
    Port 2222
`;
            const config = parse(text);
            expect(config.blocks).toHaveLength(2);
            expect(config.blocks[0]!.patterns).toEqual(['production']);
            expect(config.blocks[1]!.patterns).toEqual(['staging']);
            expect(config.blocks[1]!.directives.get('Port')).toEqual(['2222']);
        });

        it('解析 IdentityFile 多值', () => {
            const text = `
Host multi
    HostName 10.0.0.1
    IdentityFile ~/.ssh/id_rsa
    IdentityFile ~/.ssh/id_ed25519
`;
            const config = parse(text);
            expect(config.blocks[0]!.directives.get('IdentityFile')).toEqual([
                '~/.ssh/id_rsa',
                '~/.ssh/id_ed25519',
            ]);
        });

        it('解析 Host 多模式', () => {
            const text = `
Host dev staging
    HostName 10.0.0.20
    User deploy
`;
            const config = parse(text);
            expect(config.blocks[0]!.patterns).toEqual(['dev', 'staging']);
        });

        it('忽略空行与注释', () => {
            const text = `
# 这是一个注释
Host production
    HostName 192.168.1.100

# 另一个注释
    User root
`;
            const config = parse(text);
            expect(config.blocks).toHaveLength(1);
            expect(config.blocks[0]!.directives.get('User')).toEqual(['root']);
        });

        it('Host 块之前的指令归入全局块', () => {
            const text = `
Host github.com
    User git

Host *
    IdentityFile ~/.ssh/id_ed25519
`;
            const config = parse(text);
            expect(config.blocks).toHaveLength(2);
            expect(config.blocks[1]!.patterns).toEqual(['*']);
            expect(config.blocks[1]!.directives.get('IdentityFile')).toEqual(['~/.ssh/id_ed25519']);
        });

        it('遇到无法识别的行格式抛出 ConfigError', () => {
            const text = `
Host production
    BadLineWithoutValue
`;
            expect(() => parse(text)).toThrow();
        });
    });

    describe('getNamedHosts', () => {
        it('返回所有命名 Host，排除通配符', () => {
            const text = `
Host production
    HostName 192.168.1.100

Host staging
    HostName 10.0.0.20

Host *
    IdentityFile ~/.ssh/id_ed25519
`;
            const config = parse(text);
            const hosts = getNamedHosts(config);
            expect(hosts).toEqual(['production', 'staging']);
        });
    });
});