export abstract class AitermError extends Error {
    abstract readonly code: string;
    abstract readonly hint: string;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ConfigError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'CONFIG_ERROR',
        hint: string = '检查 SSH Config 语法与 Host 配置',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class ConnectionError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'CONN_ERROR',
        hint: string = '检查网络连通性与目标地址/端口',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class AuthError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'AUTH_ERROR',
        hint: string = '检查私钥路径与权限',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class KnownHostsError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'KNOWN_HOSTS_ERROR',
        hint: string = '检查 known_hosts 记录与主机密钥',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class TransferError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'TRANSFER_ERROR',
        hint: string = '检查本地与远程路径及权限',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class ExecError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'EXEC_ERROR',
        hint: string = '检查远程命令与执行环境',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export class InternalError extends AitermError {
    readonly code: string;
    readonly hint: string;

    constructor(
        message: string,
        code: string = 'INTERNAL_UNEXPECTED',
        hint: string = '可加 --debug 查看详情并提交反馈',
    ) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}

export function getExitCode(error: AitermError): number {
    if (error instanceof ConfigError) return 2;
    if (error instanceof ConnectionError) return 3;
    if (error instanceof AuthError) return 4;
    if (error instanceof KnownHostsError) return 5;
    if (error instanceof TransferError) return 6;
    return 1;
}