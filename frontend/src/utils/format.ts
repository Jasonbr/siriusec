/**
 * 通用格式化函数
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的文件大小字符串，如 "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 格式化数字，添加千位分隔符
 * @param num 数字
 * @returns 格式化后的字符串，如 "1,234,567"
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 格式化百分比
 * @param value 值
 * @param total 总数
 * @param decimals 小数位数，默认为2
 * @returns 格式化后的百分比字符串，如 "75.50%"
 */
export function formatPercentage(value: number, total: number, decimals = 2): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(decimals)}%`;
}

/**
 * 格式化IP地址（验证并标准化）
 * @param ip IP地址字符串
 * @returns 标准化后的IP地址字符串
 */
export function formatIP(ip: string): string {
  return ip.trim();
}

/**
 * 格式化主机名
 * @param hostname 主机名
 * @returns 格式化后的主机名
 */
export function formatHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

/**
 * 截断字符串，超过长度时添加省略号
 * @param str 原始字符串
 * @param maxLength 最大长度
 * @param suffix 后缀，默认为 "..."
 * @returns 截断后的字符串
 */
export function truncateString(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化会话ID（截断显示）
 * @param sessionId 会话ID
 * @param length 显示长度，默认为8
 * @returns 格式化后的会话ID，如 "abc12345..."
 */
export function formatSessionId(sessionId: string, length = 8): string {
  return `${sessionId.slice(0, length)}...`;
}

/**
 * 格式化标签名称
 * @param name 标签名称
 * @returns 格式化后的标签名称
 */
export function formatTagName(name: string): string {
  return name.trim().replace(/\s+/g, '-').toLowerCase();
}

/**
 * 格式化命令输出（去除多余空白）
 * @param output 命令输出
 * @returns 格式化后的输出
 */
export function formatCommandOutput(output: string): string {
  return output.trim().replace(/\n{3,}/g, '\n\n');
}

/**
 * 格式化URL（去除尾部斜杠）
 * @param url URL
 * @returns 格式化后的URL
 */
export function formatUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
