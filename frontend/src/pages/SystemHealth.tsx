import { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Timeline,
  Alert,
  Spin,
  Empty,
  Button,
  Space,
  Tag,
  Descriptions,
  Divider,
  Typography,
} from 'antd';
import {
  HeartOutlined,
  ReloadOutlined,
  ClusterOutlined,
  UserOutlined,
  SafetyOutlined,
  DesktopOutlined,
  CloudOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { authApi, clustersApi, usersApi, sessionsApi, appsApi, databasesApi, kubernetesApi, auditApi } from '../api/client';
import { useCluster } from '../hooks/useCluster';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface HealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: string;
}

export const SystemHealth = () => {
  const { clusterName } = useCluster();

  // 获取认证设置（健康检查）
  const { data: authSettings, isLoading: authLoading } = useQuery({
    queryKey: ['health-auth'],
    queryFn: () => authApi.getAuthSettings(),
    refetchInterval: 30000, // 30秒刷新
  });

  // 获取集群列表
  const { data: clustersData, isLoading: clustersLoading } = useQuery({
    queryKey: ['health-clusters'],
    queryFn: () => clustersApi.getClusters(),
    refetchInterval: 30000,
  });

  // 获取用户统计
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['health-users'],
    queryFn: () => usersApi.getUsers(),
    refetchInterval: 60000,
  });

  // 获取活跃会话
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['health-sessions', clusterName],
    queryFn: () => sessionsApi.getSessions(clusterName),
    refetchInterval: 10000, // 10秒刷新
  });

  // 获取应用统计
  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['health-apps', clusterName],
    queryFn: () => appsApi.getApps(clusterName),
    refetchInterval: 60000,
  });

  // 获取数据库统计
  const { data: databasesData, isLoading: databasesLoading } = useQuery({
    queryKey: ['health-databases', clusterName],
    queryFn: () => databasesApi.getDatabases(clusterName),
    refetchInterval: 60000,
  });

  // 获取K8s统计
  const { data: k8sData, isLoading: k8sLoading } = useQuery({
    queryKey: ['health-k8s', clusterName],
    queryFn: () => kubernetesApi.getClusters(clusterName),
    refetchInterval: 60000,
  });

  // 获取审计事件
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['health-events', clusterName],
    queryFn: () => auditApi.searchEvents(clusterName, { limit: 5, order: 'desc' }),
    refetchInterval: 30000,
  });

  const clusters = clustersData?.items || [];
  const users = Array.isArray(usersData) ? usersData : usersData?.items || [];
  const sessions = sessionsData?.sessions || [];
  const apps = Array.isArray(appsData) ? appsData : appsData?.items || [];
  const databases = Array.isArray(databasesData) ? databasesData : databasesData?.items || [];
  const k8sClusters = Array.isArray(k8sData) ? k8sData : k8sData?.items || [];
  const events = eventsData?.events || [];

  const isLoading = authLoading || clustersLoading || usersLoading || sessionsLoading || 
                    appsLoading || databasesLoading || k8sLoading || eventsLoading;

  // 计算组件健康状态 (useMemo to avoid infinite re-render from refetchInterval)
  const healthData = useMemo<HealthStatus[]>(() => [
    {
      name: '认证服务',
      status: authSettings ? 'healthy' : 'unhealthy',
      message: authSettings ? '运行正常' : '无法获取认证配置',
      lastCheck: new Date().toISOString(),
    },
    {
      name: '集群连接',
      status: clusters.length > 0 ? 'healthy' : 'degraded',
      message: clusters.length > 0 ? `${clusters.length} 个集群在线` : '无可用集群',
      lastCheck: new Date().toISOString(),
    },
    {
      name: '会话服务',
      status: sessions.length >= 0 ? 'healthy' : 'unhealthy',
      message: `${sessions.length} 个活跃会话`,
      lastCheck: new Date().toISOString(),
    },
    {
      name: '用户服务',
      status: users.length > 0 ? 'healthy' : 'degraded',
      message: `${users.length} 个用户`,
      lastCheck: new Date().toISOString(),
    },
  ], [authSettings, clusters.length, sessions.length, users.length]);

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
      case 'degraded':
        return <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />;
      case 'unhealthy':
        return <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
    }
  };

  const getStatusColor = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
    }
  };

  const getOverallStatus = () => {
    if (healthData.some(h => h.status === 'unhealthy')) return 'unhealthy';
    if (healthData.some(h => h.status === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallStatus = getOverallStatus();

  if (isLoading && healthData.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-12">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在加载系统健康状态...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 总体状态 */}
      <Card className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <Title level={4} className="mb-2">
              <HeartOutlined className="mr-2" />
              系统健康状态
            </Title>
            <Text type="secondary">
              最后更新: {dayjs().format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </div>
          <Space>
            <Badge
              status={getStatusColor(overallStatus) as any}
              text={
                overallStatus === 'healthy' ? '系统正常' :
                overallStatus === 'degraded' ? '系统降级' : '系统异常'
              }
              style={{ fontSize: 16 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      {/* 组件健康状态 */}
      <Row gutter={[16, 16]} className="mb-6">
        {healthData.map((item) => (
          <Col xs={24} sm={12} md={6} key={item.name}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <Text type="secondary" className="text-sm">{item.name}</Text>
                  <div className="mt-2">
                    <Badge
                      status={getStatusColor(item.status) as any}
                      text={
                        item.status === 'healthy' ? '正常' :
                        item.status === 'degraded' ? '降级' : '异常'
                      }
                    />
                  </div>
                  <Text className="text-xs mt-1 block">{item.message}</Text>
                </div>
                {getStatusIcon(item.status)}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 资源统计 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="集群"
              value={clusters.length}
              prefix={<ClusterOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="用户"
              value={users.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃会话"
              value={sessions.length}
              prefix={<DesktopOutlined />}
              valueStyle={{ color: sessions.length > 0 ? '#1890ff' : '#999' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="应用"
              value={apps.length}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细统计 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={12}>
          <Card title="资源概览">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="数据库">
                <Space>
                  <DatabaseOutlined />
                  <span>{databases.length} 个数据库</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Kubernetes 集群">
                <Space>
                  <CloudOutlined />
                  <span>{k8sClusters.length} 个集群</span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="当前集群">
                <Space>
                  <ClusterOutlined />
                  <Tag color="blue">{clusterName}</Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="认证方式">
                <Space>
                  <SafetyOutlined />
                  <Tag>{authSettings?.auth?.type || 'local'}</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="最近事件">
            {events.length === 0 ? (
              <Empty description="暂无事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Timeline>
                {events.slice(0, 5).map((event: any, index: number) => (
                  <Timeline.Item key={index}>
                    <div className="text-sm">
                      <Text strong>{event.event}</Text>
                      <div className="text-gray-500 text-xs">
                        {event.user} · {dayjs(event.time).format('MM-DD HH:mm')}
                      </div>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Card>
        </Col>
      </Row>

      {/* 系统信息 */}
      <Card title="系统信息">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="服务器版本">
                {authSettings?.server_version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="最小客户端版本">
                {authSettings?.min_client_version || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="代理地址">
                {authSettings?.proxy?.publicAddr || '-'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col xs={24} md={12}>
            <Alert
              type="info"
              showIcon
              message="健康检查"
              description="系统每 30 秒自动检查一次组件健康状态。如发现问题，请查看具体组件的详细信息。"
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default SystemHealth;
