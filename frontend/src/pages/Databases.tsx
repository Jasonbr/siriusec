import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Modal,
  Form,
  Select,
  message,
} from 'antd';
import {
  DatabaseOutlined,
  LinkOutlined,
  SearchOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { databasesApi, clustersApi } from '../api/client';
import type { DatabaseServer } from '../types/api';
import { useCluster } from '../hooks/useCluster';



// 数据库协议图标映射
const protocolIcons: Record<string, { color: string; label: string }> = {
  mysql: { color: '#4479A1', label: 'MySQL' },
  postgres: { color: '#336791', label: 'PostgreSQL' },
  mongodb: { color: '#47A248', label: 'MongoDB' },
  redis: { color: '#DC382D', label: 'Redis' },
  mssql: { color: '#CC2927', label: 'SQL Server' },
  oracle: { color: '#F80000', label: 'Oracle' },
  cockroachdb: { color: '#6933FF', label: 'CockroachDB' },
  snowflake: { color: '#29B5E8', label: 'Snowflake' },
  cassandra: { color: '#1287B1', label: 'Cassandra' },
  elasticsearch: { color: '#005571', label: 'Elasticsearch' },
};

export const Databases = () => {
  const [searchText, setSearchText] = useState('');
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [selectedDb, setSelectedDb] = useState<DatabaseServer | null>(null);
  const [form] = Form.useForm();
  const { clusterName } = useCluster();

  // 获取集群列表
  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.getClusters,
  });

  const clusters = clustersData?.items || [];
  const currentCluster = clusters[0]?.name || clusterName;

  // 获取数据库列表
  const { data: databasesData, isLoading } = useQuery({
    queryKey: ['databases', currentCluster],
    queryFn: () => databasesApi.getDatabases(currentCluster),
    enabled: !!currentCluster,
  });

  const databases: DatabaseServer[] = Array.isArray(databasesData)
    ? databasesData
    : databasesData?.items || [];

  // 过滤数据库
  const filteredDatabases = databases.filter((db) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      db.name.toLowerCase().includes(search) ||
      db.desc?.toLowerCase().includes(search) ||
      db.protocol?.toLowerCase().includes(search) ||
      db.labels?.some((l) =>
        `${l.name}:${l.value}`.toLowerCase().includes(search)
      )
    );
  });

  const handleConnect = (db: DatabaseServer) => {
    setSelectedDb(db);
    setConnectModalVisible(true);
  };

  const handleConnectSubmit = async (values: {
    username: string;
    database?: string;
  }) => {
    if (!selectedDb) return;

    // 生成连接命令
    const protocol = selectedDb.protocol;

    switch (protocol) {
      case 'mysql':
        const mysqlCmd = `mysql -h ${selectedDb.name}.${currentCluster} -P 3306 -u ${values.username}${values.database ? ` -D ${values.database}` : ''}`;
        message.success(mysqlCmd);
        navigator.clipboard.writeText(mysqlCmd);
        break;
      case 'postgres':
        const pgCmd = `psql postgres://${values.username}@${selectedDb.name}.${currentCluster}:5432/${values.database || 'postgres'}`;
        message.success(pgCmd);
        navigator.clipboard.writeText(pgCmd);
        break;
      case 'redis':
        const redisCmd = `redis-cli -h ${selectedDb.name}.${currentCluster} -p 6379`;
        message.success(redisCmd);
        navigator.clipboard.writeText(redisCmd);
        break;
      default:
        const defaultCmd = `tsh db connect ${selectedDb.name}`;
        message.success(defaultCmd);
        navigator.clipboard.writeText(defaultCmd);
    }

    setConnectModalVisible(false);
    form.resetFields();
  };

  const getProtocolTag = (protocol: string) => {
    const config = protocolIcons[protocol] || {
      color: '#666',
      label: protocol.toUpperCase(),
    };
    return (
      <Tag color={config.color} className="font-medium">
        {config.label}
      </Tag>
    );
  };

  const columns = [
    {
      title: '数据库名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DatabaseServer) => (
        <Space direction="vertical" size={0}>
          <span className="font-medium">{text}</span>
          {record.desc && (
            <span className="text-gray-400 text-xs">{record.desc}</span>
          )}
        </Space>
      ),
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 120,
      render: (protocol: string) => getProtocolTag(protocol),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => (
        <Badge
          status={type === 'self-hosted' ? 'processing' : 'default'}
          text={type === 'self-hosted' ? '自托管' : type}
        />
      ),
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels: DatabaseServer['labels']) => (
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
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: DatabaseServer) => (
        <Space>
          <Tooltip title="连接数据库">
            <Button
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => handleConnect(record)}
            >
              连接
            </Button>
          </Tooltip>
          <Tooltip title="查看连接信息">
            <Button
              icon={<CodeOutlined />}
              onClick={() => {
                Modal.info({
                  title: '连接信息',
                  content: (
                    <div className="mt-4 space-y-2">
                      <div>
                        <strong>数据库名:</strong> {record.name}
                      </div>
                      <div>
                        <strong>协议:</strong> {record.protocol}
                      </div>
                      <div>
                        <strong>连接地址:</strong>{' '}
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {record.name}.{currentCluster}
                        </code>
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        使用 tsh 命令行工具连接:
                        <br />
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs block mt-1">
                          tsh db connect {record.name}
                        </code>
                      </div>
                    </div>
                  ),
                });
              }}
            >
              信息
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title={
          <Space>
            <DatabaseOutlined />
            <span>数据库访问</span>
          </Space>
        }
      >
        <Space className="mb-4" wrap>
          <Input
            placeholder="搜索数据库..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        {filteredDatabases.length === 0 && !isLoading ? (
          <Empty
            description={
              searchText ? '未找到匹配的数据库' : '暂无数据库服务器'
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredDatabases}
            rowKey="name"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个数据库`,
            }}
          />
        )}
      </Card>

      {/* 连接模态框 */}
      <Modal
        title={`连接到 ${selectedDb?.name}`}
        open={connectModalVisible}
        onCancel={() => {
          setConnectModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleConnectSubmit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入数据库用户名" />
          </Form.Item>

          <Form.Item name="database" label="数据库（可选）">
            <Input placeholder="输入数据库名称" />
          </Form.Item>

          <Form.Item className="mt-6">
            <Space>
              <Button type="primary" htmlType="submit">
                生成连接命令
              </Button>
              <Button
                onClick={() => {
                  setConnectModalVisible(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-600">
          <p className="font-medium mb-2">提示：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>请确保已安装 tsh 命令行工具</li>
            <li>使用 tsh login 登录到集群</li>
            <li>连接命令将自动复制到剪贴板</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
};
