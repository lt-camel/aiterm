/**
 * Exec 模块：一次性远程命令执行的类型定义。
 *
 * 对应架构文档 §13–§15。ExecResult 是 exec() 的返回契约，
 * ExecOptions 控制执行行为（如超时）。
 */

/**
 * 远程命令执行结果。
 *
 * @property stdout 标准输出内容
 * @property stderr 标准错误内容
 * @property exitCode 远程命令退出码（0 表示成功）
 */
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * 远程命令执行选项。
 *
 * @property timeout 命令执行超时（毫秒）。超时后抛 ExecError(EXEC_TIMEOUT)。
 *                   不设置或为 0 表示无超时。
 */
export interface ExecOptions {
    timeout?: number;
}