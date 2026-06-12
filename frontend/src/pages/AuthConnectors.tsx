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
  Tabs,
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
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  GithubOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authConnectorsApi } from '../api/client';
import type { AuthConnector, OIDCConnectorSpec, SAMLConnectorSpec, GitHubConnectorSpec } from '../types/api';

const { Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

type ConnectorType = 'oidc' | 'saml' | 'github';

interface ConnectorFormData {
  name: string;
  display?: string;
  description?: string;
  // OIDC fields
  issuer_url?: string;
  client_id?: string;
  client_secret?: string;
  redirect_url?: string;
  scopes?: string;
  // SAML fields
  acs?: string;
  entity_descriptor?: string;
  entity_descriptor_url?: string;
  // GitHub fields
  teams_to_roles?: string;
}

export const AuthConnectors = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState<AuthConnector | null>(null);
  const [connectorType, setConnectorType] = useState<ConnectorType>('oidc');
  const [form] = Form.useForm<ConnectorFormData>();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingConnector, setTestingConnector] = useState<AuthConnector | null>(null);

  // 获取连接器列表
  const { data: connectors = [], isLoading, error } = useQuery({
    queryKey: ['auth-connectors'],
    queryFn: () => authConnectorsApi.getConnectors(),
  });

  // 创建连接器
  const createMutation = useMutation({
    mutationFn: (connector: AuthConnector) => authConnectorsApi.createConnector({ connector }),
    onSuccess: () => {
      message.success('认证连接器创建成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    },
  });

  // 更新连接器
  const updateMutation = useMutation({
    mutationFn: ({ type, name, connector }: { type: ConnectorType; name: string; connector: AuthConnector }) =>
      authConnectorsApi.updateConnector(type, name, { connector }),
    onSuccess: () => {
      message.success('认证连接器更新成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
      setIsModalOpen(false);
      setEditingConnector(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '更新失败');
    },
  });

  // 删除连接器
  const deleteMutation = useMutation({
    mutationFn: ({ type, name }: { type: ConnectorType; name: string }) =>
      authConnectorsApi.deleteConnector(type, name),
    onSuccess: () => {
      message.success('认证连接器删除成功');
      queryClient.invalidateQueries({ queryKey: ['auth-connectors'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    },
  });

  // 测试连接器
  const testMutation = useMutation({
    mutationFn: (connector: AuthConnector) => authConnectorsApi.testConnector({ connector }),
    onSuccess: (result) => {
      if (result.success) {
        message.success('连接测试成功');
      } else {
        message.error(result.message || '连接测试失败');
      }
      setTestModalOpen(false);
      setTestingConnector(null);
    },
    onError: (error: any) => {
      message.error(error.message || '测试失败');
      setTestModalOpen(false);
      setTestingConnector(null);
    },
  });

  const handleCreate = () => {
    setEditingConnector(null);
    setConnectorType('oidc');
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleEdit = (connector: AuthConnector) => {
    setEditingConnector(connector);
    setConnectorType(connector.kind);
    form.setFieldsValue({
      name: connector.metadata.name,
      display: connector.metadata.display,
      description: connector.metadata.description,
      ...flattenSpec(connector.kind, connector.spec),
    });
    setIsModalOpen(true);
  };

  const handleDelete = (connector: AuthConnector) => {
    deleteMutation.mutate({ type: connector.kind, name: connector.metadata.name });
  };

  const handleTest = (connector: AuthConnector) => {
    setTestingConnector(connector);
    setTestModalOpen(true);
    testMutation.mutate(connector);
  };

  const handleSubmit = (values: ConnectorFormData) => {
    const connector: AuthConnector = {
      kind: connectorType,
      version: 'v3',
      metadata: {
        name: values.name,
        display: values.display,
        description: values.description,
      },
      spec: buildSpec(connectorType, values),
    };

    if (editingConnector) {
      updateMutation.mutate({
        type: editingConnector.kind,
        name: editingConnector.metadata.name,
        connector,
      });
    } else {
      createMutation.mutate(connector);
    }
  };

  const flattenSpec = (type: ConnectorType, spec: any): Partial<ConnectorFormData> => {
    switch (type) {
      case 'oidc':
        const oidcSpec = spec as OIDCConnectorSpec;
        return {
          issuer_url: oidcSpec.issuer_url,
          client_id: oidcSpec.client_id,
          client_secret: oidcSpec.client_secret,
          redirect_url: oidcSpec.redirect_url,
          scopes: oidcSpec.scopes?.join(','),
        };
      case 'saml':
        const samlSpec = spec as SAMLConnectorSpec;
        return {
          acs: samlSpec.acs,
          entity_descriptor: samlSpec.entity_descriptor,
          entity_descriptor_url: samlSpec.entity_descriptor_url,
        };
      case 'github':
        const githubSpec = spec as GitHubConnectorSpec;
        return {
          client_id: githubSpec.client_id,
          client_secret: githubSpec.client_secret,
          redirect_url: githubSpec.redirect_url,
          teams_to_roles: JSON.stringify(githubSpec.teams_to_roles, null, 2),
        };
      default:
        return {};
    }
  };

  const buildSpec = (type: ConnectorType, values: ConnectorFormData): OIDCConnectorSpec | SAMLConnectorSpec | GitHubConnectorSpec => {
    switch (type) {
      case 'oidc':
        return {
          issuer_url: values.issuer_url || '',
          client_id: values.client_id || '',
          client_secret: values.client_secret,
          redirect_url: values.redirect_url,
          scopes: values.scopes?.split(',').map(s => s.trim()).filter(Boolean),
          display: values.display,
        } as OIDCConnectorSpec;
      case 'saml':
        return {
          acs: values.acs || '',
          entity_descriptor: values.entity_descriptor,
          entity_descriptor_url: values.entity_descriptor_url,
          display: values.display,
        } as SAMLConnectorSpec;
      case 'github':
        return {
          client_id: values.client_id || '',
          client_secret: values.client_secret,
          redirect_url: values.redirect_url,
          display: values.display,
          teams_to_roles: values.teams_to_roles ? JSON.parse(values.teams_to_roles) : [],
        } as GitHubConnectorSpec;
      default:
        return {} as OIDCConnectorSpec;
    }
  };

  const getConnectorIcon = (type: ConnectorType) => {
    switch (type) {
      case 'oidc':
        return <GlobalOutlined />;
      case 'saml':
        return <SafetyCertificateOutlined />;
      case 'github':
        return <GithubOutlined />;
      default:
        return null;
    }
  };

  const getConnectorTypeLabel = (type: ConnectorType) => {
    switch (type) {
      case 'oidc':
        return 'OIDC';
      case 'saml':
        return 'SAML';
      case 'github':
        return 'GitHub';
      default:
        return type;
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      render: (name: string, record: AuthConnector) => (
        <Space>
          {getConnectorIcon(record.kind)}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: ConnectorType) => (
        <Tag color={kind === 'oidc' ? 'blue' : kind === 'saml' ? 'green' : 'purple'}>
          {getConnectorTypeLabel(kind)}
        </Tag>
      ),
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
      render: (_: any, record: AuthConnector) => (
        <Space size="small">
          <Button
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => handleTest(record)}
            loading={testMutation.isPending && testingConnector?.metadata.name === record.metadata.name}
          >
            测试
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
            description={`确定要删除连接器 "${record.metadata.name}" 吗？`}
            onConfirm={() => handleDelete(record)}
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
          description="无法加载认证连接器列表，请检查网络连接或权限设置。"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title={<Title level={4}>认证连接器</Title>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建连接器
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          message="认证连接器"
          description="配置 OIDC、SAML 或 GitHub OAuth 认证，允许用户使用外部身份提供商登录系统。"
          className="mb-4"
        />

        <Table
          columns={columns}
          dataSource={connectors}
          rowKey={(record) => `${record.kind}-${record.metadata.name}`}
          loading={isLoading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty
                description="暂无认证连接器"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* 创建/编辑连接器模态框 */}
      <Modal
        title={editingConnector ? '编辑认证连接器' : '新建认证连接器'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingConnector(null);
          form.resetFields();
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ type: 'oidc' }}
        >
          {!editingConnector && (
            <Form.Item
              label="连接器类型"
              name="type"
              initialValue="oidc"
            >
              <Select
                value={connectorType}
                onChange={(value: ConnectorType) => {
                  setConnectorType(value);
                  form.resetFields(['issuer_url', 'client_id', 'client_secret', 'redirect_url', 'scopes', 'acs', 'entity_descriptor', 'entity_descriptor_url', 'teams_to_roles']);
                }}
                options={[
                  { label: 'OIDC', value: 'oidc' },
                  { label: 'SAML', value: 'saml' },
                  { label: 'GitHub', value: 'github' },
                ]}
              />
            </Form.Item>
          )}

          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: '请输入连接器名称' }]}
          >
            <Input placeholder="例如：google-oidc" disabled={!!editingConnector} />
          </Form.Item>

          <Form.Item
            label="显示名称"
            name="display"
          >
            <Input placeholder="例如：Google 登录" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={2} placeholder="可选描述信息" />
          </Form.Item>

          <Divider />

          {/* OIDC 特定字段 */}
          {connectorType === 'oidc' && (
            <>
              <Title level={5}>OIDC 配置</Title>
              <Form.Item
                label="Issuer URL"
                name="issuer_url"
                rules={[{ required: true, message: '请输入 Issuer URL' }]}
              >
                <Input placeholder="https://accounts.google.com" />
              </Form.Item>

              <Form.Item
                label="Client ID"
                name="client_id"
                rules={[{ required: true, message: '请输入 Client ID' }]}
              >
                <Input placeholder="your-client-id" />
              </Form.Item>

              <Form.Item
                label="Client Secret"
                name="client_secret"
                rules={[{ required: !editingConnector, message: '请输入 Client Secret' }]}
              >
                <Input.Password placeholder="your-client-secret" />
              </Form.Item>

              <Form.Item
                label="Redirect URL"
                name="redirect_url"
              >
                <Input placeholder="https://your-domain/auth/callback" />
              </Form.Item>

              <Form.Item
                label="Scopes"
                name="scopes"
              >
                <Input placeholder="openid,email,profile" />
              </Form.Item>
            </>
          )}

          {/* SAML 特定字段 */}
          {connectorType === 'saml' && (
            <>
              <Title level={5}>SAML 配置</Title>
              <Form.Item
                label="ACS URL"
                name="acs"
                rules={[{ required: true, message: '请输入 ACS URL' }]}
              >
                <Input placeholder="https://your-domain/webapi/saml/acs" />
              </Form.Item>

              <Form.Item
                label="Entity Descriptor (XML)"
                name="entity_descriptor"
              >
                <TextArea rows={6} placeholder="粘贴 IdP 元数据 XML" />
              </Form.Item>

              <Form.Item
                label="Entity Descriptor URL"
                name="entity_descriptor_url"
              >
                <Input placeholder="https://idp.example.com/metadata" />
              </Form.Item>
            </>
          )}

          {/* GitHub 特定字段 */}
          {connectorType === 'github' && (
            <>
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
                rules={[{ required: !editingConnector, message: '请输入 Client Secret' }]}
              >
                <Input.Password placeholder="your-github-client-secret" />
              </Form.Item>

              <Form.Item
                label="Redirect URL"
                name="redirect_url"
              >
                <Input placeholder="https://your-domain/auth/callback" />
              </Form.Item>

              <Form.Item
                label="Teams to Roles (JSON)"
                name="teams_to_roles"
              >
                <TextArea
                  rows={6}
                  placeholder={`[\n  {\n    "organization": "myorg",\n    "team": "admins",\n    "roles": ["admin"]\n  }\n]`}
                />
              </Form.Item>
            </>
          )}

          <Form.Item className="mt-6">
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {editingConnector ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setIsModalOpen(false);
                setEditingConnector(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 测试连接模态框 */}
      <Modal
        title="测试连接器"
        open={testModalOpen}
        onCancel={() => {
          setTestModalOpen(false);
          setTestingConnector(null);
        }}
        footer={null}
        closable={!testMutation.isPending}
        maskClosable={!testMutation.isPending}
      >
        {testMutation.isPending ? (
          <div className="text-center py-8">
            <div>正在测试连接器 "{testingConnector?.metadata.name}"...</div>
          </div>
        ) : testMutation.isSuccess ? (
          <Alert
            type="success"
            message="测试成功"
            description="连接器配置正确，可以正常使用。"
            showIcon
          />
        ) : testMutation.isError ? (
          <Alert
            type="error"
            message="测试失败"
            description={testMutation.error?.message || '连接测试失败，请检查配置。'}
            showIcon
          />
        ) : null}
      </Modal>
    </div>
  );
};

export default AuthConnectors;
