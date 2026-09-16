/**
 * PTY 管理模块。
 *
 * 管理远程 PTY 的创建与生命周期。
 */

export interface PTYOptions {
    term?: string;
    cols?: number;
    rows?: number;
}

/**
 * 创建 PTY 选项，合并默认值。
 *
 * @param options 用户提供的选项
 * @returns 完整的 PTY 选项
 */
export function createPTYOptions(options?: PTYOptions): Required<PTYOptions> {
    return {
        term: options?.term ?? 'xterm-256color',
        cols: options?.cols ?? 80,
        rows: options?.rows ?? 24,
    };
}