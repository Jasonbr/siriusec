import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  Input,
  Empty,
  Tooltip,
  Badge,
  message,
  Modal,
  Spin,
} from 'antd';
import {
  AppstoreOutlined,
  LinkOutlined,
  GlobalOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { appsApi, clustersApi } from '../api/client';
import type { AppServer } from '../types/api';
import { useCluster } from '../hooks/useCluster';

export const Apps = () => {
  const [searchText, setSearchText] = useState('');
  const [launchingApp, setLaunchingApp] = useState<AppServer | null>(null);
  const { clusterName } = useCluster();

  // 创建应用会话 mutation
  const createSessionMutation = useMutation({
    mutationFn: async (app: AppServer) => {
      const response = await appsApi.createAppSession(app.name, clusterName);
      return response;
    },
    onSuccess: (data, app) => {
      message.success('应用会话创建成功');
      setLaunchingApp(null);
      // 打开应用代理链接
      const proxyUrl = `https://${app.fqdn}`;
      window.open(proxyUrl, '_blank');
    },
    onError: (error: any) => {
      message.error(error.message || '创建应用会话失败');
      setLaunchingApp(null);
    },
  });

  // 获取集群列表
  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.getClusters,
  });

  const clusters = clustersData?.items || [];
  const currentCluster = clusters[0]?.name || clusterName;

  // 获取应用列表
  const { data: appsData, isLoading } = useQuery({
    queryKey: ['apps', currentCluster],
    queryFn: () => appsApi.getApps(currentCluster),
    enabled: !!currentCluster,
  });

  const apps: AppServer[] = Array.isArray(appsData)
    ? appsData
    : appsData?.items || [];

  // 过滤应用
  const filteredApps = apps.filter((app) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      app.name.toLowerCase().includes(search) ||
      app.description?.toLowerCase().includes(search) ||
      app.publicAddr?.toLowerCase().includes(search) ||
      app.labels?.some((l) =>
        `${l.name}:${l.value}`.toLowerCase().includes(search)
      )
    );
  });

  const handleLaunchApp = (app: AppServer) => {
    setLaunchingApp(app);
    createSessionMutation.mutate(app);
  };

  const columns = [
    {
      title: '应用名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: AppServer) => (
        <Space direction="vertical" size={0}>
          <span className="font-medium">{text}</span>
          {record.description && (
            <span className="text-gray-400 text-xs">{record.description}</span>
          )}
        </Space>
      ),
    },
    {
      title: '地址',
      dataIndex: 'publicAddr',
      key: 'publicAddr',
      render: (text: string, record: AppServer) => (
        <Space>
          <GlobalOutlined />
          <span>{text || record.fqdn}</span>
        </Space>
      ),
    },
    {
      title: '内部地址',
      dataIndex: 'uri',
      key: 'uri',
      render: (text: string) => (
        <Tag color="blue" className="font-mono text-xs">
          {text}
        </Tag>
      ),
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels: AppServer['labels']) => (
        <Space size={[4, 4]} wrap>
          {labels?.map((label) => (
            <Tag key={`${label.name}:${label.value}`} className="text-xs">
              {label.name}: {label.value}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '类型',
      key: 'type',
      render: (_: unknown, record: AppServer) => (
        <Space>
          {record.awsConsole ? (
            <Badge status="processing" text="AWS Console" />
          ) : (
            <Badge status="success" text="Web 应用" />
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: AppServer) => (
        <Tooltip title="打开应用">
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => handleLaunchApp(record)}
          >
            访问
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>应用访问</span>
          </Space>
        }
      >
        <Space className="mb-4" wrap>
          <Input
            placeholder="搜索应用..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        {filteredApps.length === 0 && !isLoading ? (
          <Empty
            description={
              searchText ? '未找到匹配的应用' : '暂无应用服务器'
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredApps}
            rowKey="name"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个应用`,
            }}
          />
        )}
      </Card>

      {/* 启动应用会话加载模态框 */}
      <Modal
        title="正在启动应用"
        open={!!launchingApp}
        footer={null}
        closable={false}
        centered
      >
        <div className="text-center py-8">
          <Spin size="large" />
          <p className="mt-4 text-gray-600">
            正在为 {launchingApp?.name} 创建应用会话...
          </p>
        </div>
      </Modal>
    </div>
  );
};
