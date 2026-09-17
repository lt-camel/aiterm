/**
 * Transfer 模块：文件传输的类型定义。
 *
 * 对应架构文档 §18–§19。TransferResult 是 upload/download 的返回契约，
 * TransferOptions 控制传输行为（进度回调、递归目录）。
 */

/**
 * 文件传输结果。
 *
 * @property bytes 传输字节数
 * @property local 本地路径
 * @property remote 远程路径
 */
export interface TransferResult {
    bytes: number;
    local: string;
    remote: string;
}

/**
 * 文件传输选项。
 *
 * @property onProgress 进度回调，transferred 为已传输字节数，total 为总字节数
 * @property recursive 递归目录传输（uploadDir / downloadDir）
 */
export interface TransferOptions {
    onProgress?: (transferred: number, total: number) => void;
    recursive?: boolean;
}