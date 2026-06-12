import type { ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import type { UserContext } from '../types/api';

interface PermissionGuardProps {
  resource: keyof UserContext['userAcl'];
  action: 'list' | 'read' | 'edit' | 'create' | 'delete';
  children: ReactNode;
  fallback?: ReactNode;
}

export const PermissionGuard = ({
  resource,
  action,
  children,
  fallback = null,
}: PermissionGuardProps) => {
  const { user } = useAuthStore();

  if (!user) {
    return <>{fallback}</>;
  }

  const acl = user.userAcl[resource];

  if (!acl) {
    return <>{fallback}</>;
  }

  // action 'delete' 在 API 中对应 'remove'
  const permissionKey = action === 'delete' ? 'remove' : action;
  const hasPermission = acl[permissionKey as keyof typeof acl];

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

// 便捷权限检查 Hook
export const usePermission = (resource: keyof UserContext['userAcl'], action: 'list' | 'read' | 'edit' | 'create' | 'delete') => {
  const { user } = useAuthStore();

  if (!user) return false;

  const acl = user.userAcl[resource];
  if (!acl) return false;

  const permissionKey = action === 'delete' ? 'remove' : action;
  return acl[permissionKey as keyof typeof acl];
};
