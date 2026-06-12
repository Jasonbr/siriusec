import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout as AntLayout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  theme,
  Select,
  Spin,
} from 'antd';
import {
  DashboardOutlined,
  DesktopOutlined,
  TeamOutlined,
  SafetyOutlined,
  FileTextOutlined,
  ClusterOutlined,
  LogoutOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  CloudOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  KeyOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useCluster } from '../hooks/useCluster';
import { useQuery } from '@tanstack/react-query';
import { clustersApi } from '../api/client';
import { NamespaceSelector } from './NamespaceSelector';

const { Header, Sider, Content } = AntLayout;

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const { clusterName, setClusterName } = useCluster();
  const [collapsed, setCollapsed] = useState(false);

  // 获取集群列表
  const { data: clustersData, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => clustersApi.getClusters(),
  });

  const clusters = clustersData?.items || [];

  const handleClusterChange = (value: string) => {
    setClusterName(value);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/nodes',
      icon: <DesktopOutlined />,
      label: '节点管理',
      resource: 'nodes',
      action: 'list' as const,
    },
    {
      key: '/sessions',
      icon: <ClusterOutlined />,
      label: '会话管理',
      resource: 'sessions',
      action: 'list' as const,
    },
    {
      key: 'resources',
      icon: <AppstoreOutlined />,
      label: '资源访问',
      children: [
        {
          key: '/apps',
          icon: <AppstoreOutlined />,
          label: '应用访问',
          resource: 'appServers',
          action: 'list' as const,
        },
        {
          key: '/databases',
          icon: <DatabaseOutlined />,
          label: '数据库访问',
          resource: 'dbServers',
          action: 'list' as const,
        },
        {
          key: '/kubernetes',
          icon: <CloudOutlined />,
          label: 'Kubernetes',
          resource: 'kubeServers',
          action: 'list' as const,
        },
      ],
    },
    {
      key: '/audit',
      icon: <FileTextOutlined />,
      label: '审计日志',
      resource: 'events',
      action: 'list' as const,
    },
    {
      key: 'access',
      icon: <SafetyOutlined />,
      label: '访问控制',
      children: [
        {
          key: '/users',
          icon: <TeamOutlined />,
          label: '用户管理',
          resource: 'users',
          action: 'list' as const,
        },
        {
          key: '/roles',
          icon: <SafetyOutlined />,
          label: '角色管理',
          resource: 'roles',
          action: 'list' as const,
        },
        {
          key: '/auth-connectors',
          icon: <SafetyCertificateOutlined />,
          label: '认证连接器',
          resource: 'authConnectors',
          action: 'list' as const,
        },
        {
          key: '/trusted-clusters',
          icon: <GlobalOutlined />,
          label: '可信集群',
          resource: 'trustedClusters',
          action: 'list' as const,
        },
        {
          key: '/access-requests',
          icon: <SafetyCertificateOutlined />,
          label: '访问请求',
          resource: 'accessRequests',
          action: 'list' as const,
        },
        {
          key: '/tokens',
          icon: <KeyOutlined />,
          label: '令牌管理',
          resource: 'tokens',
          action: 'list' as const,
        },
      ],
    },
    {
      key: '/system-health',
      icon: <HeartOutlined />,
      label: '系统健康',
      resource: 'events',
      action: 'list' as const,
    },
    {
      key: '/system-settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      resource: 'events',
      action: 'list' as const,
    },
  ];

  // 过滤掉无权限的菜单项
  const filterMenuItems = (items: any[]): any[] => {
    return items
      .map((item) => {
        if (item.resource && item.action) {
          const acl = user?.userAcl[item.resource];
          if (!acl?.[item.action]) {
            return null;
          }
        }

        if (item.children) {
          const filteredChildren = filterMenuItems(item.children);
          if (filteredChildren.length === 0) {
            return null;
          }
          return { ...item, children: filteredChildren };
        }

        return item;
      })
      .filter(Boolean);
  };

  const filteredMenuItems = filterMenuItems(menuItems);

  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <SettingOutlined />,
      onClick: () => navigate('/settings'),
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={240}
        style={{
          borderRight: '1px solid #e8e8e8',
          background: '#ffffff',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 24,
          borderBottom: '1px solid #f0f0f0',
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 16,
            fontWeight: 'bold',
            flexShrink: 0,
          }}>
            S
          </div>
          {!collapsed && (
            <span style={{
              marginLeft: 12,
              fontSize: 18,
              fontWeight: 600,
              color: '#1a1a1a',
              whiteSpace: 'nowrap',
            }}>
              Siriusec
            </span>
          )}
        </div>

        {/* 集群选择器 */}
        {!collapsed && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>当前集群</div>
            {clustersLoading ? (
              <Spin size="small" />
            ) : (
              <Select
                value={clusterName}
                onChange={handleClusterChange}
                style={{ width: '100%' }}
                size="small"
                options={clusters.map((cluster: any) => ({
                  label: cluster.name,
                  value: cluster.name,
                }))}
              />
            )}
          </div>
        )}

        {/* 命名空间选择器 */}
        {!collapsed && (
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>命名空间</div>
            <NamespaceSelector
              style={{ width: '100%' }}
              size="small"
            />
          </div>
        )}

        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['access', 'resources']}
          items={filteredMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            border: 'none',
            padding: '8px 0',
          }}
        />
      </Sider>

      <AntLayout style={{ marginLeft: collapsed ? 80 : 240 }}>
        <Header
          style={{
            background: '#ffffff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            height: 64,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: 16,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'background 0.2s',
            }}>
              <Avatar
                style={{
                  background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                  fontSize: 16,
                }}
              >
                {(user?.userName || localStorage.getItem('username') || 'admin').charAt(0).toUpperCase()}
              </Avatar>
              <span style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#262626',
              }}>
                {user?.userName || localStorage.getItem('username') || 'admin'}
              </span>
              <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: '16px',
            padding: 24,
            minHeight: 280,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};
