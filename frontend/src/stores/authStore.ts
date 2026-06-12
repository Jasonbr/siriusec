import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState } from '../types/api';
import { authApi, setBearerToken } from '../api/client';

interface AuthStore extends AuthState {
  // Actions
  login: (username: string, password: string, secondFactorToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUserContext: (clusterName: string) => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      bearerToken: null,
      csrfToken: null,
      user: null,

      login: async (username: string, password: string, secondFactorToken?: string) => {
        const response = await authApi.login({
          user: username,
          pass: password,
          second_factor_token: secondFactorToken || '',
        });

        const csrfToken = localStorage.getItem('csrf_token');

        // 保存用户名
        localStorage.setItem('username', username);

        set({
          isAuthenticated: true,
          bearerToken: response.token, // 仅用于 store 状态，不再存储到 localStorage
          csrfToken: csrfToken,
        });

        // 获取用户上下文
        await get().fetchUserContext(response.clusterName || '-current-');
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          get().clearAuth();
        }
      },

      fetchUserContext: async (clusterName: string) => {
        const userContext = await authApi.getUserContext(clusterName);
        set({ user: userContext });
      },

      clearAuth: () => {
        localStorage.removeItem('csrf_token');
        localStorage.removeItem('username');
        set({
          isAuthenticated: false,
          bearerToken: null,
          csrfToken: null,
          user: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        bearerToken: state.bearerToken,
        csrfToken: state.csrfToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // 页面刷新后，从 localStorage 恢复时同步设置 client.ts 的内存变量
          if (state?.bearerToken) {
            setBearerToken(state.bearerToken);
          }
        };
      },
    }
  )
);
