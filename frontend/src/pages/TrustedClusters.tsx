import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Descriptions,
  Badge,
  Popconfirm,
  Empty,
  Alert,
  Typography,
  Divider,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  CopyOutlined,
  GlobalOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trustedClustersApi } from '../api/client';
import type { TrustedCluster, RoleMapping } from '../types/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const TrustedClusters = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<TrustedCluster | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<TrustedCluster | null>(null);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [form] = Form.useForm();

  // 获取可信集群列表
  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ['trusted-clusters'],
    queryFn: () => trustedClustersApi.getTrustedClusters(),
  });

  // 创建可信集群
  const createMutation = useMutation({
    mutationFn: (cluster: TrustedCluster) =>
      trustedClustersApi.createTrustedCluster({ cluster }),
    onSuccess: () => {
      message.success('可信集群创建成功');
      queryClient.invalidateQueries({ queryKey: ['trusted-clusters'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    },
  });

  // 更新可信集群
  const updateMutation = useMutation({
    mutationFn: ({ name, cluster }: { name: string; cluster: TrustedCluster }) =>
      trustedClustersApi.updateTrustedCluster(name, { cluster }),
    onSuccess: () => {
      message.success('可信集群更新成功');
      queryClient.invalidateQueries({ queryKey: ['trusted-clusters'] });
      setIsModalOpen(false);
      setEditingCluster(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '更新失败');
    },
  });

  // 删除可信集群
  const deleteMutation = useMutation({
    mutationFn: (name: string) => trustedClustersApi.deleteTrustedCluster(name),
    onSuccess: () => {
      message.success('可信集群删除成功');
      queryClient.invalidateQueries({ queryKey: ['trusted-clusters'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    },
  });

  // 生成加入令牌
  const generateTokenMutation = useMutation({
    mutationFn: () => trustedClustersApi.generateJoinToken(),
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setTokenModalVisible(true);
      message.success('加入令牌生成成功');
    },
    onError: (error: any) => {
      message.error(error.message || '生成令牌失败');
    },
  });

  const handleCreate = () => {
    setEditingCluster(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (cluster: TrustedCluster) => {
    setEditingCluster(cluster);
    form.setFieldsValue({
      name: cluster.metadata.name,
      description: cluster.metadata.description,
      enabled: cluster.spec.enabled,
      proxy_address: cluster.spec.proxy_address,
      token: cluster.spec.token,
    });
    setIsModalOpen(true);
  };

  const handleViewDetail = (cluster: TrustedCluster) => {
    setSelectedCluster(cluster);
    setDetailModalVisible(true);
  };

  const handleDelete = (name: string) => {
    deleteMutation.mutate(name);
  };

  const handleSubmit = (values: any) => {
    const cluster: TrustedCluster = {
      kind: 'trusted_cluster',
      version: 'v2',
      metadata: {
        name: values.name,
        description: values.description,
      },
      spec: {
        enabled: values.enabled ?? true,
        token: values.token,
        proxy_address: values.proxy_address,
        role_map: values.role_map || [],
      },
    };

    if (editingCluster) {
      updateMutation.mutate({
        name: editingCluster.metadata.name,
        cluster,
      });
    } else {
      createMutation.mutate(cluster);
    }
  };

  const getStatusBadge = (status?: TrustedCluster['status']) => {
    if (!status) return <Badge status="default" text="未知" />;
    switch (status.state) {
      case 'connected':
        return <Badge status="success" text="已连接" />;
      case 'disconnected':
        return <Badge status="error" text="已断开" />;
      case 'pending':
        return <Badge status="warning" text="待连接" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  const columns = [
    {
      title: '集群名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      render: (name: string, record: TrustedCluster) => (
        <Space>
          <GlobalOutlined />
          <span className="font-medium">{name}</span>
        </Space>
      ),
    },
    {
      title: '代理地址',
      dataIndex: ['spec', 'proxy_address'],
      key: 'proxy_address',
      render: (addr: string) => (
        <Tag color="blue" className="font-mono">{addr}</Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: TrustedCluster) => getStatusBadge(record.status),
    },
    {
      title: '启用',
      dataIndex: ['spec', 'enabled'],
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '最后连接',
      dataIndex: ['status', 'last_connected'],
      key: 'last_connected',
      render: (time: string) => time || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: TrustedCluster) => (
        <Space size="small">
          <Button
            icon={<SafetyOutlined />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除可信集群 "${record.metadata.name}" 吗？`}
            onConfirm={() => handleDelete(record.metadata.name)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              loading={deleteMutation.isPending}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title={<Title level={4}>可信集群</Title>}
        extra={
          <Space>
            <Button
              type="default"
              icon={<LinkOutlined />}
              onClick={() => generateTokenMutation.mutate()}
              loading={generateTokenMutation.isPending}
            >
              生成加入令牌
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              添加可信集群
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="可信集群"
          description="可信集群允许您建立与其他 Sirius 集群的信任关系，实现跨集群的资源访问和用户同步。"
          className="mb-4"
        />

        <Table
          columns={columns}
          dataSource={clusters}
          rowKey={(record) => record.metadata.name}
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无可信集群"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* 创建/编辑可信集群模态框 */}
      <Modal
        title={editingCluster ? '编辑可信集群' : '添加可信集群'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingCluster(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ enabled: true }}
        >
          <Form.Item
            label="集群名称"
            name="name"
            rules={[{ required: true, message: '请输入集群名称' }]}
          >
            <Input placeholder="例如：production-cluster" disabled={!!editingCluster} />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>

          <Form.Item
            label="代理地址"
            name="proxy_address"
            rules={[{ required: true, message: '请输入代理地址' }]}
          >
            <Input placeholder="例如：https://siriusec.example.com:443" />
          </Form.Item>

          <Form.Item
            label="加入令牌"
            name="token"
            rules={[{ required: !editingCluster, message: '请输入加入令牌' }]}
          >
            <Input.Password placeholder="从目标集群生成的加入令牌" />
          </Form.Item>

          <Form.Item
            label="启用"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item className="mt-6">
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingCluster ? '更新' : '创建'}
              </Button>
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingCluster(null);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 可信集群详情模态框 */}
      <Modal
        title="可信集群详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedCluster(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setDetailModalVisible(false);
              setSelectedCluster(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedCluster && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="集群名称">
              {selectedCluster.metadata.name}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedCluster.metadata.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="代理地址">
              <Tag color="blue">{selectedCluster.spec.proxy_address}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusBadge(selectedCluster.status)}
            </Descriptions.Item>
            <Descriptions.Item label="启用状态">
              <Tag color={selectedCluster.spec.enabled ? 'green' : 'red'}>
                {selectedCluster.spec.enabled ? '已启用' : '已禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后连接">
              {selectedCluster.status?.last_connected || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="最后状态检查">
              {selectedCluster.status?.last_status_check || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 加入令牌模态框 */}
      <Modal
        title="加入令牌"
        open={tokenModalVisible}
        onCancel={() => {
          setTokenModalVisible(false);
          setGeneratedToken('');
        }}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => {
              navigator.clipboard.writeText(generatedToken);
              message.success('令牌已复制到剪贴板');
            }}
          >
            复制令牌
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setTokenModalVisible(false);
              setGeneratedToken('');
            }}
          >
            关闭
          </Button>,
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="安全提示"
          description="此令牌用于其他集群加入当前集群的信任关系。请安全保存，不要泄露给未授权的用户。"
          className="mb-4"
        />
        <div className="bg-gray-100 p-4 rounded">
          <Text className="font-mono text-sm break-all">{generatedToken}</Text>
        </div>
      </Modal>
    </div>
  );
};

export default TrustedClusters;
