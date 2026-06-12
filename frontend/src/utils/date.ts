/**
 * 日期时间工具函数
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import duration from 'dayjs/plugin/duration';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.locale('zh-cn');

/**
 * 格式化日期时间为字符串
 * @param date 日期对象或时间戳或ISO字符串
 * @param format 格式化模板，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | number | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format);
}

/**
 * 格式化相对时间
 * @param date 日期对象或时间戳或ISO字符串
 * @returns 相对时间字符串，如 "3分钟前"
 */
export function formatRelativeTime(date: string | number | Date): string {
  return dayjs(date).fromNow();
}

/**
 * 计算两个日期之间的差值（毫秒）
 * @param date1 日期1
 * @param date2 日期2，默认为当前时间
 * @returns 差值毫秒数
 */
export function dateDiff(date1: string | number | Date, date2?: string | number | Date): number {
  const d1 = dayjs(date1);
  const d2 = date2 ? dayjs(date2) : dayjs();
  return d2.diff(d1);
}

/**
 * 计算剩余时间（毫秒）
 * @param expiryDate 过期日期
 * @returns 剩余毫秒数，如果已过期则返回0
 */
export function getRemainingTime(expiryDate: string | number | Date): number {
  const now = dayjs();
  const expiry = dayjs(expiryDate);
  return Math.max(0, expiry.diff(now));
}

/**
 * 判断日期是否已过期
 * @param expiryDate 过期日期
 * @returns 是否已过期
 */
export function isExpired(expiryDate: string | number | Date): boolean {
  return dayjs(expiryDate).isBefore(dayjs());
}

/**
 * 将毫秒数转换为可读的时间字符串
 * @param milliseconds 毫秒数
 * @returns 可读的时间字符串，如 "2小时30分钟"
 */
export function formatDuration(milliseconds: number): string {
  const duration = dayjs.duration(milliseconds);
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${seconds}秒`;
  }
  return `${seconds}秒`;
}

/**
 * 获取今天开始的日期时间字符串
 * @returns 今天 00:00:00 的ISO字符串
 */
export function startOfToday(): string {
  return dayjs().startOf('day').toISOString();
}

/**
 * 获取今天结束的日期时间字符串
 * @returns 今天 23:59:59 的ISO字符串
 */
export function endOfToday(): string {
  return dayjs().endOf('day').toISOString();
}

/**
 * 解析时间字符串为Date对象
 * @param dateString ISO格式的时间字符串
 * @returns Date对象
 */
export function parseDate(dateString: string): Date {
  return dayjs(dateString).toDate();
}
