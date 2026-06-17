import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Card,
  Tooltip,
  Select,
  Spin,
  message,
  Badge,
} from 'antd';
import {
  DesktopOutlined,
  GlobalOutlined,
  SearchOutlined,
  CodeOutlined,
  FolderOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { nodesApi, sessionsApi } from '../api/client';
import type { Node } from '../types/api';
import { PermissionGuard } from '../components/PermissionGuard';
import { Terminal } from '../components/Terminal';
import { FileTransfer } from '../components/FileTransfer';
import { useAuthStore } from '../stores/authStore';
import { useCluster } from '../hooks/useCluster';

const { Option } = Select;

export const Nodes = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [fileTransferVisible, setFileTransferVisible] = useState(false);
  const [selectedLogins, setSelectedLogins] = useState<Record<string, string>>({});
  const [creatingSession, setCreatingSession] = useState(false);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const { clusterName } = useCluster();

  const createSessionMutation = useMutation({
    mutationFn: async ({ node, login }: { node: Node; login: string }) => {
      return await sessionsApi.createSession(clusterName, 'default', {
        session: {
          server_id: node.id,
          login,
          terminal_params: { w: 120, h: 40 },
        },
      });
    },
    onSuccess: (data) => {
      setCreatingSession(false);
      const sessionId = data?.session?.id;
      if (sessionId) {
        setCreatedSessionId(sessionId);
      }
      setTerminalVisible(true);
    },
    onError: (error: any) => {
      setCreatingSession(false);
      const errorMsg = error?.response?.data?.message || error?.message || '创建会话失败';
      message.error(errorMsg);
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nodes', clusterName],
    queryFn: async () => {
      const res = await nodesApi.getNodes(clusterName);
      return res;
    },
  });

  const nodes: Node[] = Array.isArray(data)
    ? data
    : (data as { items: Node[] })?.items || [];

  // 获取可用的登录用户列表
  const availableLogins = user?.userAcl?.sshLogins || ['root'];

  const filteredNodes = nodes.filter(
    (node) =>
      node.hostname.toLowerCase().includes(searchText.toLowerCase()) ||
      node.addr.toLowerCase().includes(searchText.toLowerCase()) ||
      node.tags.some((tag) =>
        tag.name.toLowerCase().includes(searchText.toLowerCase()) ||
        tag.value.toLowerCase().includes(searchText.toLowerCase())
      )
  );

  const columns = [
    {
      title: '主机名',
      dataIndex: 'hostname',
      key: 'hostname',
      render: (text: string, record: Node) => (
        <Space>
          <DesktopOutlined />
          <span className="font-medium">{text}</span>
          {record.tunnel && <Tag color="orange">隧道</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: Node) => {
        const connectionType = record.tunnel ? '隧道连接' : '直连';
        
        return (
          <Space direction="vertical" size={0}>
            <Badge status="success" text="在线" />
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>{connectionType}</span>
          </Space>
        );
      },
    },
    {
      title: '地址',
      dataIndex: 'addr',
      key: 'addr',
      render: (text: string) => (
        <Space>
          <GlobalOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text.slice(0, 8)}...</span>
        </Tooltip>
      ),
    },
    {
      title: '集群',
      dataIndex: 'siteId',
      key: 'siteId',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: Node['tags']) => (
        <Space wrap>
          {tags.map((tag) => (
            <Tag key={`${tag.name}:${tag.value}`} color="blue">
              {tag.name}: {tag.value}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_: unknown, record: Node) => (
        <PermissionGuard resource="nodes" action="read">
          <Space>
            <Select
              placeholder="选择用户"
              size="small"
              style={{ width: 100 }}
              value={selectedLogins[record.id] || availableLogins[0]}
              onChange={(value) => setSelectedLogins(prev => ({ ...prev, [record.id]: value }))}
            >
              {availableLogins.map((login) => (
                <Option key={login} value={login}>
                  {login}
                </Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<CodeOutlined />}
              size="small"
              onClick={() => openTerminal(record)}
            >
              连接
            </Button>
            <Button
              icon={<FolderOutlined />}
              size="small"
              onClick={() => openFileTransfer(record)}
            >
              文件
            </Button>
          </Space>
        </PermissionGuard>
      ),
    },
  ];

  const openTerminal = (node: Node) => {
    const login = selectedLogins[node.id] || availableLogins[0] || 'root';
    setSelectedNode(node);
    setCreatingSession(true);
    createSessionMutation.mutate({ node, login });
  };

  const openFileTransfer = (node: Node) => {
    setSelectedNode(node);
    setFileTransferVisible(true);
  };

  const handleCloseTerminal = () => {
    setTerminalVisible(false);
    setSelectedNode(null);
    setCreatedSessionId(null);
  };

  const handleCloseFileTransfer = () => {
    setFileTransferVisible(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">节点管理</h1>
        <Space>
          <Input
            placeholder="搜索节点..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button onClick={() => refetch()}>刷新</Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredNodes}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个节点`,
          }}
          locale={{
            emptyText: '暂无节点数据',
          }}
        />
      </Card>

      {/* 创建会话加载 */}
      {creatingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在创建会话...</p>
          </div>
        </div>
      )}

      {/* SSH 终端 */}
      {selectedNode && (
        <Terminal
          clusterName={clusterName}
          serverId={selectedNode.id}
          login={selectedLogins[selectedNode.id] || availableLogins[0] || 'root'}
          serverHostname={selectedNode.hostname}
          sessionId={createdSessionId || undefined}
          visible={terminalVisible}
          onClose={handleCloseTerminal}
        />
      )}

      {/* 文件传输 */}
      <FileTransfer
        node={selectedNode}
        login={selectedLogins[selectedNode?.id || ''] || availableLogins[0] || 'root'}
        clusterName={clusterName}
        visible={fileTransferVisible}
        onClose={handleCloseFileTransfer}
      />
    </div>
  );
};
