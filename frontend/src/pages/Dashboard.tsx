import { useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, Tag, Typography, Divider } from 'antd';
import {
  ClusterOutlined,
  DesktopOutlined,
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { clustersApi, nodesApi, usersApi, sessionsApi } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useCluster } from '../hooks/useCluster';
import { Cluster, Node, User, Session } from '../types/api';

const { Title, Text } = Typography;

export const Dashboard = () => {
  const { user, fetchUserContext } = useAuthStore();
  const { clusterName } = useCluster();

  // 获取集群列表
  const { data: clustersData, isLoading: clustersLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: async () => {
      const res = await clustersApi.getClusters();
      return res as { items: Cluster[] };
    },
  });
  const clusters = Array.isArray(clustersData) ? clustersData : clustersData?.items || [];

  // 获取节点列表
  const { data: nodesData, isLoading: nodesLoading } = useQuery({
    queryKey: ['nodes', clusterName],
    queryFn: async () => {
      const res = await nodesApi.getNodes(clusterName);
      return res as { items: Node[] };
    },
    enabled: user?.userAcl.nodes.list,
  });

  // 获取用户列表
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.getUsers();
      return res as { items: User[] };
    },
    enabled: user?.userAcl.users.list,
  });
  const users = Array.isArray(usersData) ? usersData : usersData?.items || [];

  // 获取活跃会话
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', clusterName],
    queryFn: async () => {
      const res = await sessionsApi.getSessions(clusterName);
      return res as { sessions: Session[] };
    },
    enabled: user?.userAcl.sessions.list,
  });

  // 刷新用户上下文
  useEffect(() => {
    if (user?.cluster?.name) {
      fetchUserContext(user.cluster.name);
    }
  }, []);

  const currentCluster = clusters[0];
  const nodes: Node[] = Array.isArray(nodesData)
    ? nodesData
    : (nodesData as { items: Node[] })?.items || [];
  const sessions = sessionsData?.sessions || [];

  const isLoading = clustersLoading || nodesLoading || usersLoading || sessionsLoading;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}>仪表板</Title>
        <Text type="secondary">系统概览与资源监控</Text>
      </div>

      {/* 集群状态 */}
      {currentCluster && (
        <Card
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClusterOutlined style={{ color: '#1890ff' }} />
              集群状态
            </span>
          }
          style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #f0f0f0' }}
        >
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="集群名称"
                value={currentCluster.name}
                prefix={<ClusterOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="状态"
                value={currentCluster.status === 'online' ? '在线' : '离线'}
                valueStyle={{
                  color: currentCluster.status === 'online' ? '#52c41a' : '#ff4d4f',
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="节点数量"
                value={nodes.length}
                prefix={<DesktopOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="版本"
                value={currentCluster.authVersion || '7.3.9'}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Statistic
              title="活跃会话"
              value={sessions.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Statistic
              title="注册用户"
              value={users.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Statistic
              title="在线节点"
              value={nodes.filter((n) => !n.tunnel).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}>
            <Statistic
              title="隧道节点"
              value={nodes.filter((n) => n.tunnel).length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 用户信息 */}
        {user && (
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  当前用户
                </span>
              }
              style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>用户名</Text>
                  <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>{user.userName}</div>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>认证类型</Text>
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    {user.authType === 'local' ? '本地认证' : 'SSO'}
                  </div>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>角色</Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {user.accessCapabilities?.requestableRoles && user.accessCapabilities.requestableRoles.length > 0 ? (
                      user.accessCapabilities.requestableRoles.map((role) => (
                        <Tag key={role} color="blue" style={{ borderRadius: 4 }}>
                          {role}
                        </Tag>
                      ))
                    ) : (
                      <>
                        {user.userAcl.users.edit ? <Tag color="red" style={{ borderRadius: 4 }}>管理员</Tag> : 
                         user.userAcl.sessions.read ? <Tag color="blue" style={{ borderRadius: 4 }}>审计员</Tag> : 
                         <Tag style={{ borderRadius: 4 }}>普通用户</Tag>}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        )}

        {/* 权限概览 */}
        {user?.userAcl && (
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  权限概览
                </span>
              }
              style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            >
              <Row gutter={[12, 12]}>
                {Object.entries(user.userAcl)
                  .filter(([key]) => key !== 'sshLogins')
                  .map(([key, acl]) => (
                    <Col span={6} key={key}>
                      <div style={{
                        textAlign: 'center',
                        padding: '8px 4px',
                        background: '#fafafa',
                        borderRadius: 8,
                      }}>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                          {getResourceLabel(key)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          {acl.list && <Tag color="green" style={{ borderRadius: 4, margin: 0 }}>读</Tag>}
                          {acl.edit && <Tag color="blue" style={{ borderRadius: 4, margin: 0 }}>写</Tag>}
                          {!acl.list && !acl.edit && <Tag style={{ borderRadius: 4, margin: 0 }}>无</Tag>}
                        </div>
                      </div>
                    </Col>
                  ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

function getResourceLabel(key: string): string {
  const labels: Record<string, string> = {
    sessions: '会话',
    authConnectors: '认证连接器',
    roles: '角色',
    users: '用户',
    trustedClusters: '可信集群',
    events: '审计事件',
    tokens: '令牌',
    nodes: '节点',
    appServers: '应用',
    dbServers: '数据库',
    kubeServers: 'Kubernetes',
    accessRequests: '访问请求',
    billing: '计费',
  };
  return labels[key] || key;
}
