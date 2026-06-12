import { useEffect, useRef, useCallback } from 'react';
import { sessionsApi } from '../api/client';
import { useCluster } from './useCluster';
import { useAuthStore } from '../stores/authStore';

const RENEWAL_INTERVAL = 5 * 60 * 1000; // 5分钟
const WARNING_THRESHOLD = 10 * 60 * 1000; // 10分钟警告

interface SessionRenewalOptions {
  sessionId?: string;
  namespace?: string;
  enabled?: boolean;
  onWarning?: (remainingTime: number) => void;
  onExpired?: () => void;
}

export function useSessionRenewal(options: SessionRenewalOptions) {
  const { sessionId, namespace = 'default', enabled = true, onWarning, onExpired } = options;
  const { clusterName } = useCluster();
  const { user } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningRef = useRef(false);

  // 计算会话剩余时间
  const getRemainingTime = useCallback((): number => {
    // 从登录响应中获取会话过期时间
    // 注意：这里需要从authStore中获取sessionExpires，但目前UserContext没有这个字段
    // 暂时使用一个默认值，后续需要更新authStore来存储sessionExpires
    const sessionExpires = (user as any)?.sessionExpires;
    if (!sessionExpires) {
      // 如果没有过期时间，假设会话还有30分钟
      return 30 * 60 * 1000;
    }
    const expiresAt = new Date(sessionExpires).getTime();
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  }, [user]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 续期会话
    const renewSession = async () => {
      try {
        await sessionsApi.renewSession(clusterName, namespace, sessionId);
        console.log('Session renewed successfully');
        warningRef.current = false; // 重置警告标志
      } catch (error: any) {
        console.error('Failed to renew session:', error);
        // 如果续期失败（会话已过期），触发过期回调
        if (error.response?.status === 404 || error.response?.status === 401) {
          onExpired?.();
        }
      }
    };

    // 初始续期
    renewSession();

    // 设置定时续期
    intervalRef.current = setInterval(renewSession, RENEWAL_INTERVAL);

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clusterName, namespace, sessionId, enabled, onExpired]);

  // 检查会话过期警告
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const checkWarning = () => {
      const remainingTime = getRemainingTime();

      if (remainingTime < WARNING_THRESHOLD && remainingTime > 0 && !warningRef.current) {
        warningRef.current = true;
        onWarning?.(remainingTime);
      }

      // 如果会话已过期，触发过期回调
      if (remainingTime === 0) {
        onExpired?.();
      }
    };

    // 立即检查一次
    checkWarning();

    const warningInterval = setInterval(checkWarning, 60000); // 每分钟检查

    return () => {
      clearInterval(warningInterval);
    };
  }, [sessionId, enabled, onWarning, onExpired, getRemainingTime]);

  // 手动续期函数
  const manualRenew = async () => {
    if (!sessionId) return;
    try {
      await sessionsApi.renewSession(clusterName, namespace, sessionId);
      warningRef.current = false;
    } catch (error: any) {
      console.error('Manual renewal failed:', error);
      throw error;
    }
  };

  return { manualRenew, getRemainingTime };
}

export default useSessionRenewal;
