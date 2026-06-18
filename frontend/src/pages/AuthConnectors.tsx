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
  message,
  Alert,
  Typography,
  Divider,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authConnectorsApi } from '../api/client';
import type { AuthConnector, GitHubConnectorSpec, TeamMapping } from '../types/api';

const { Title } = Typography;
const { TextArea } = Input;

interface ConnectorFormData {
  name: string;
  display?: string;
  description?: string;
  client_id?: string;
  client_secret?: string;
  redirect_url?: string;
  teams_to_roles?: string;
}

export const AuthConnectors = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<AuthConnector | null>(null);
  const [form] = Form.useForm<ConnectorFormData>();

  const { data: connectors = [], isLoading, error } = useQuery({
    queryKey: ['auth-connectors'],
    queryFn: () => authConnectorsApi.getConnectors(),
  });

  const createMutation = useMutation({
    mutationFn: (connector: AuthConnector) => authConnectorsApi.createConnector({ connector }),
    onSuccess: () => {
      message.success('GitHub 连接器创建成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, connector }: { name: string; connector: AuthConnector }) =>
      authConnectorsApi.updateConnector('github', name, { connector }),
    onSuccess: () => {
      message.success('GitHub 连接器更新成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
      setIsModalOpen(false);
      setEditingConnector(null);
      form.resetFields();
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => authConnectorsApi.deleteConnector('github', name),
    onSuccess: () => {
      message.success('GitHub 连接器删除成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : '删除失败');
    },
  });

  const handleCreate = () => {
    setEditingConnector(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (connector: AuthConnector) => {
    setEditingConnector(connector);
    const spec = connector.spec as GitHubConnectorSpec;
    form.setFieldsValue({
      name: connector.metadata.name,
      display: connector.metadata.display ?? spec.display,
      description: connector.metadata.description,
      client_id: spec.client_id,
      redirect_url: spec.redirect_url,
      teams_to_roles: JSON.stringify(spec.teams_to_roles ?? [], null, 2),
    });
    setIsModalOpen(true);
  };

  const parseTeamsToRoles = (raw: string | undefined): TeamMapping[] => {
    if (!raw || !raw.trim()) return [];
    const parsed = JSON.parse(raw) as TeamMapping[];
    if (!Array.isArray(parsed)) {
      throw new Error('teams_to_roles 必须是 JSON 数组');
    }
    return parsed;
  };

  const handleSubmit = (values: ConnectorFormData) => {
    let teams: TeamMapping[];
    try {
      teams = parseTeamsToRoles(values.teams_to_roles);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'teams_to_roles 解析失败');
      return;
    }

    const spec: GitHubConnectorSpec = {
      client_id: values.client_id ?? '',
      client_secret: values.client_secret,
      redirect_url: values.redirect_url,
      display: values.display,
      teams_to_roles: teams,
    };

    const connector: AuthConnector = {
      kind: 'github',
      version: 'v3',
      metadata: {
        name: values.name,
        display: values.display,
        description: values.description,
      },
      spec,
    };

    if (editingConnector) {
      updateMutation.mutate({ name: editingConnector.metadata.name, connector });
    } else {
      createMutation.mutate(connector);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingConnector(null);
    form.resetFields();
  };

  const columns = [
    {
      title: '名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      render: (name: string) => (
        <Space>
          <GithubOutlined />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      key: 'kind',
      render: () => <Tag color="purple">GitHub</Tag>,
    },
    {
      title: '显示名称',
      dataIndex: ['metadata', 'display'],
      key: 'display',
      render: (display: string) => display || '-',
    },
    {
      title: '描述',
      dataIndex: ['metadata', 'description'],
      key: 'description',
      render: (desc: string) => desc || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: AuthConnector) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除连接器 "${record.metadata.name}" 吗？`}
            onConfirm={() => deleteMutation.mutate(record.metadata.name)}
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

  if (error) {
    return (
      <div className="p-6">
        <Alert
          type="error"
          message="加载失败"
          description="无法加载 GitHub 连接器列表，请检查网络连接或权限设置。"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title={<Title level={4}>GitHub 认证连接器</Title>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建连接器
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          message="GitHub OAuth 连接器"
          description="配置 GitHub OAuth 应用，允许用户使用 GitHub 账号登录系统。OIDC / SAML 管理接口后端暂未实现。"
          className="mb-4"
        />

        <Table
          columns={columns}
          dataSource={connectors}
          rowKey={(record) => `github-${record.metadata.name}`}
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无 GitHub 连接器"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      <Modal
        title={editingConnector ? '编辑 GitHub 连接器' : '新建 GitHub 连接器'}
        open={isModalOpen}
        onCancel={handleClose}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入连接器名称' }]}
          >
            <Input placeholder="例如：myorg-github" disabled={!!editingConnector} />
          </Form.Item>

          <Form.Item label="显示名称" name="display">
            <Input placeholder="例如：GitHub 登录" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>

          <Divider />

          <Title level={5}>GitHub OAuth 配置</Title>

          <Form.Item
            label="Client ID"
            name="client_id"
            rules={[{ required: true, message: '请输入 Client ID' }]}
          >
            <Input placeholder="your-github-client-id" />
          </Form.Item>

          <Form.Item
            label="Client Secret"
            name="client_secret"
            rules={[
              {
                required: !editingConnector,
                message: '请输入 Client Secret（编辑时留空表示不修改）',
              },
            ]}
          >
            <Input.Password placeholder="your-github-client-secret" />
          </Form.Item>

          <Form.Item label="Redirect URL" name="redirect_url">
            <Input placeholder="https://your-domain/v1/webapi/github/callback" />
          </Form.Item>

          <Form.Item label="Teams to Roles (JSON 数组)" name="teams_to_roles">
            <TextArea
              rows={6}
              placeholder={`[\n  {\n    "organization": "myorg",\n    "team": "admins",\n    "roles": ["admin"]\n  }\n]`}
            />
          </Form.Item>

          <Form.Item className="mt-6">
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingConnector ? '更新' : '创建'}
              </Button>
              <Button onClick={handleClose}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AuthConnectors;
