/**
 * 表单验证工具函数
 */

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 是否有效
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国大陆）
 * @param phone 手机号
 * @returns 是否有效
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证IP地址格式
 * @param ip IP地址
 * @returns 是否有效
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

/**
 * 验证主机名格式
 * @param hostname 主机名
 * @returns 是否有效
 */
export function isValidHostname(hostname: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(hostname) && hostname.length <= 255;
}

/**
 * 验证URL格式
 * @param url URL
 * @returns 是否有效
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证密码强度
 * @param password 密码
 * @param options 验证选项
 * @returns 验证结果
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
  } = {}
): { valid: boolean; errors: string[] } {
  const {
    minLength = 8,
    requireUppercase = false,
    requireLowercase = false,
    requireNumbers = false,
    requireSpecialChars = false,
  } = options;

  const errors: string[] = [];

  if (password.length < minLength) {
    errors.push(`密码长度至少为 ${minLength} 个字符`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.push('密码必须包含数字');
  }

  if (requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 验证用户名格式
 * @param username 用户名
 * @returns 验证结果
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
  if (!username || username.length < 3) {
    return { valid: false, error: '用户名至少为3个字符' };
  }

  if (username.length > 32) {
    return { valid: false, error: '用户名不能超过32个字符' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: '用户名只能包含字母、数字、下划线和连字符' };
  }

  return { valid: true };
}

/**
 * 验证必填字段
 * @param value 字段值
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validateRequired(value: any, fieldName = '此字段'): { valid: boolean; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName}为必填项` };
  }

  return { valid: true };
}

/**
 * 验证字符串长度
 * @param value 字符串值
 * @param min 最小长度
 * @param max 最大长度
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validateStringLength(
  value: string,
  min: number,
  max: number,
  fieldName = '此字段'
): { valid: boolean; error?: string } {
  if (!value || value.length < min) {
    return { valid: false, error: `${fieldName}至少为${min}个字符` };
  }

  if (value.length > max) {
    return { valid: false, error: `${fieldName}不能超过${max}个字符` };
  }

  return { valid: true };
}
