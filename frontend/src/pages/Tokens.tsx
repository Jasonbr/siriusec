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
  Select,
  message,
  Badge,
  Popconfirm,
  Empty,
  Alert,
  Typography,
  Descriptions,
  Divider,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  KeyOutlined,
  CopyOutlined as CopyIcon,
  SafetyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi, rolesApi } from '../api/client';
import type { Token, Role, CreateTokenRequest } from '../types/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const Tokens = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isTokenDisplayModalOpen, setIsTokenDisplayModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [newToken, setNewToken] = useState<string>('');
  const [form] = Form.useForm();

  // 获取令牌列表
  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => tokensApi.getTokens(),
  });

  // 获取角色列表
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getRoles();
      return res as { items: Role[] };
    },
  });

  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // 创建令牌
  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; roles: string[]; expires?: string }) => {
      const request: CreateTokenRequest = {
        metadata: {
          name: values.name,
          description: values.description,
        },
        spec: {
          roles: values.roles,
          expires: values.expires,
        },
      };
      return tokensApi.createToken(request);
    },
    onSuccess: (data) => {
      message.success('令牌创建成功');
      setNewToken(data.token);
      setIsTokenDisplayModalOpen(true);
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    },
  });

  // 删除令牌
  const deleteMutation = useMutation({
    mutationFn: (tokenId: string) => tokensApi.deleteToken(tokenId),
    onSuccess: () => {
      message.success('令牌已删除');
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    },
  });

  const handleCreate = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleDelete = (tokenId: string) => {
    deleteMutation.mutate(tokenId);
  };

  const handleViewDetail = (token: Token) => {
    setSelectedToken(token);
    setIsDetailModalOpen(true);
  };

  const handleSubmit = (values: { name: string; description?: string; roles: string[]; expires?: string }) => {
    createMutation.mutate(values);
  };

  const getStatusBadge = (expires?: string) => {
    if (!expires) return <Badge status="success" text="永不过期" />;
    const isExpired = dayjs(expires).isBefore(dayjs());
    if (isExpired) return <Badge status="error" text="已过期" />;
    return <Badge status="processing" text="有效" />;
  };

  const columns = [
    {
      title: '令牌名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      render: (name: string, record: Token) => (
        <Space>
          <KeyOutlined />
          <span className="font-medium">{name}</span>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: ['metadata', 'description'],
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: '角色',
      dataIndex: ['spec', 'roles'],
      key: 'roles',
      render: (roles: string[]) => (
        <Space size={[4, 4]} wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue">{role}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: ['spec', 'expires'],
      key: 'status',
      render: (expires: string) => getStatusBadge(expires),
    },
    {
      title: '创建时间',
      dataIndex: ['metadata', 'created'],
      key: 'created',
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '-',
    },
    {
      title: '过期时间',
      dataIndex: ['spec', 'expires'],
      key: 'expires',
      render: (time: string) => time ? dayjs(time).format('MM-DD HH:mm') : '永不过期',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Token) => (
        <Space size="small">
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除令牌 "${record.metadata.name}" 吗？`}
            onConfirm={() => handleDelete(record.id)}
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
        title={<Title level={4}>令牌管理</Title>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建令牌
          </Button>
        }
      >
        <Alert
          type="warning"
          showIcon
          message="安全提示"
          description="API 令牌具有与创建者相同的权限。请妥善保管令牌，不要泄露给未授权的用户。令牌一旦创建将无法再次查看完整值。"
          className="mb-4"
        />

        <Table
          columns={columns}
          dataSource={tokens}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个令牌`,
          }}
          locale={{
            emptyText: (
              <Empty
                description="暂无令牌"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* 创建令牌模态框 */}
      <Modal
        title="新建令牌"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="令牌名称"
            name="name"
            rules={[{ required: true, message: '请输入令牌名称' }]}
          >
            <Input placeholder="例如：ci-cd-token" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>

          <Form.Item
            label="角色"
            name="roles"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择令牌的角色"
              options={roles.map((role: any) => ({
                label: role.name || role.metadata?.name,
                value: role.name || role.metadata?.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="过期时间"
            name="expires"
          >
            <Select
              placeholder="选择过期时间（可选）"
              allowClear
              options={[
                { label: '永不过期', value: '' },
                { label: '1 小时', value: '1h' },
                { label: '24 小时', value: '24h' },
                { label: '7 天', value: '7d' },
                { label: '30 天', value: '30d' },
                { label: '90 天', value: '90d' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                创建
              </Button>
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  form.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 令牌详情模态框 */}
      <Modal
        title="令牌详情"
        open={isDetailModalOpen}
        onCancel={() => {
          setIsDetailModalOpen(false);
          setSelectedToken(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setIsDetailModalOpen(false);
              setSelectedToken(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={500}
      >
        {selectedToken && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="令牌 ID">
              <span className="font-mono">{selectedToken.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="名称">
              {selectedToken.metadata.name}
            </Descriptions.Item>
            <Descriptions.Item label="描述">
              {selectedToken.metadata.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="角色">
              <Space size={[4, 4]} wrap>
                {selectedToken.spec.roles.map((role) => (
                  <Tag key={role} color="blue">{role}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusBadge(selectedToken.spec.expires)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedToken.metadata.created ?
                dayjs(selectedToken.metadata.created).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {selectedToken.spec.expires ?
                dayjs(selectedToken.spec.expires).format('YYYY-MM-DD HH:mm:ss') : '永不过期'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 新令牌显示模态框 */}
      <Modal
        title="令牌创建成功"
        open={isTokenDisplayModalOpen}
        onCancel={() => {
          setIsTokenDisplayModalOpen(false);
          setNewToken('');
        }}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<CopyIcon />}
            onClick={() => {
              navigator.clipboard.writeText(newToken);
              message.success('令牌已复制到剪贴板');
            }}
          >
            复制令牌
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setIsTokenDisplayModalOpen(false);
              setNewToken('');
            }}
          >
            关闭
          </Button>,
        ]}
        width={600}
        closable={false}
        maskClosable={false}
      >
        <Alert
          type="warning"
          showIcon
          message="重要提示"
          description="此令牌只会显示一次，请立即复制并安全保存。关闭此对话框后将无法再次查看完整令牌。"
          className="mb-4"
        />
        <div className="bg-gray-100 p-4 rounded">
          <Text className="font-mono text-sm break-all">{newToken}</Text>
        </div>
      </Modal>
    </div>
  );
};

export default Tokens;
