import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Nodes } from './pages/Nodes';
import { Sessions } from './pages/Sessions';
import { Users } from './pages/Users';
import { Roles } from './pages/Roles';
import { Audit } from './pages/Audit';
import { Apps } from './pages/Apps';
import { Databases } from './pages/Databases';
import { Kubernetes } from './pages/Kubernetes';
import { Settings } from './pages/Settings';
import { ResetPassword } from './pages/ResetPassword';
import { ForgotPassword } from './pages/ForgotPassword';
import { SSOCallback } from './pages/SSOCallback';
import { AuthConnectors } from './pages/AuthConnectors';
import { TrustedClusters } from './pages/TrustedClusters';
import { AccessRequests } from './pages/AccessRequests';
import { Tokens } from './pages/Tokens';
import { SystemHealth } from './pages/SystemHealth';
import { SystemSettings } from './pages/SystemSettings';
import './index.css';

// 创建 QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5分钟
      refetchOnWindowFocus: false,
    },
  },
});

// 邀请链接重定向组件：/web/invite/:token → /reset-password?token=TOKEN
const InviteRedirect = () => {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/reset-password?token=${token}`} replace />;
};

// 受保护路由组件
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// 公开路由（已登录用户重定向到首页）
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, clearAuth } = useAuthStore();

  // 检查 URL 是否有 logout 参数
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('forceLogout') || searchParams.get('logout')) {
    clearAuth();
    // 清除 URL 中的参数
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (isAuthenticated && !searchParams.get('forceLogout') && !searchParams.get('logout')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
          },
        }}
      >
        <BrowserRouter basename="/web">
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route path="/invite/:token" element={<InviteRedirect />} />
            <Route path="/reset/:token" element={<InviteRedirect />} />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/auth/callback"
              element={
                <PublicRoute>
                  <SSOCallback />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="nodes" element={<Nodes />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="users" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="audit" element={<Audit />} />
              <Route path="apps" element={<Apps />} />
              <Route path="databases" element={<Databases />} />
              <Route path="kubernetes" element={<Kubernetes />} />
              <Route path="settings" element={<Settings />} />
              <Route path="auth-connectors" element={<AuthConnectors />} />
              <Route path="trusted-clusters" element={<TrustedClusters />} />
              <Route path="access-requests" element={<AccessRequests />} />
              <Route path="tokens" element={<Tokens />} />
              <Route path="system-health" element={<SystemHealth />} />
              <Route path="system-settings" element={<SystemSettings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
