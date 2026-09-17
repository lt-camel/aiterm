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
 * 目录传输进度信息。
 *
 * 仅在递归目录传输时提供，单文件传输时为 undefined。
 *
 * @property fileIndex 当前文件序号（1-based）
 * @property fileCount 文件总数
 * @property currentFile 当前文件相对路径
 * @property fileTransferred 当前文件已传输字节数
 * @property fileTotal 当前文件总字节数
 */
export interface DirProgressInfo {
    fileIndex: number;
    fileCount: number;
    currentFile: string;
    fileTransferred: number;
    fileTotal: number;
}

/**
 * 文件传输选项。
 *
 * @property onProgress 进度回调，transferred 为目录整体已传输字节数，total 为目录总字节数；
 *                       info 仅在递归目录传输时提供
 * @property recursive 递归目录传输（uploadDir / downloadDir）
 */
export interface TransferOptions {
    onProgress?: (transferred: number, total: number, info?: DirProgressInfo) => void;
    recursive?: boolean;
}