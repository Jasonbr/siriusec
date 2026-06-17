import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

const CLUSTER_STORAGE_KEY = 'selected_cluster';

/**
 * 获取和设置当前集群名称
 * 优先从 localStorage 获取，其次从 authStore，最后回退到 '-current-'
 */
export function useCluster(): { clusterName: string; setClusterName: (name: string) => void } {
  const user = useAuthStore((state) => state.user);
  const storeClusterName = useAuthStore((state) => state.clusterName);
  const [clusterName, setClusterNameState] = useState(() => {
    // 优先从 localStorage 获取
    const saved = localStorage.getItem(CLUSTER_STORAGE_KEY);
    if (saved) return saved;
    // 其次从 authStore 的 clusterName
    if (storeClusterName) return storeClusterName;
    // 再次从 user.cluster.name
    return user?.cluster?.name || '-current-';
  });

  // 当 user 或 storeClusterName 变化时更新集群名称
  useEffect(() => {
    const newClusterName = storeClusterName || user?.cluster?.name;
    if (newClusterName && !localStorage.getItem(CLUSTER_STORAGE_KEY)) {
      setClusterNameState(newClusterName);
    }
  }, [storeClusterName, user?.cluster?.name]);

  const setClusterName = (name: string) => {
    localStorage.setItem(CLUSTER_STORAGE_KEY, name);
    setClusterNameState(name);
  };

  return { clusterName, setClusterName };
}
