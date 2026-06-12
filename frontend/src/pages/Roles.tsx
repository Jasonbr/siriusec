import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Card,
  Modal,
  Form,
  message,
  Popconfirm,
  Drawer,
} from 'antd';
import {
  SafetyOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi } from '../api/client';
import type { Role } from '../types/api';
import { PermissionGuard } from '../components/PermissionGuard';

export const Roles = () => {
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isViewDrawerVisible, setIsViewDrawerVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewingRole, setViewingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取角色列表
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getRoles();
      return res as { items: Role[] };
    },
  });
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // 创建/更新角色
  const upsertMutation = useMutation({
    mutationFn: (values: { name: string; content: string }) =>
      rolesApi.upsertRole(values),
    onSuccess: () => {
      message.success(editingRole ? '角色更新成功' : '角色创建成功');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsModalVisible(false);
      setEditingRole(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '操作失败');
    },
  });

  // 删除角色
  const deleteMutation = useMutation({
    mutationFn: (name: string) => rolesApi.deleteRole(name),
    onSuccess: () => {
      message.success('角色删除成功');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    },
  });

  const filteredRoles = roles.filter(
    (role) => {
      const name = role.name?.toLowerCase() || '';
      const content = role.content?.toLowerCase() || '';
      return name.includes(searchText.toLowerCase()) ||
        content.includes(searchText.toLowerCase());
    }
  );

  const columns = [
    {
      title: '角色名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <SafetyOutlined />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'kind',
      key: 'kind',
      render: () => <Tag color="blue">role</Tag>,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <PermissionGuard resource="roles" action="edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="roles" action="delete">
            <Popconfirm
              title="确认删除"
              description={`确定要删除角色 "${record.name}" 吗？`}
              onConfirm={() => deleteMutation.mutate(record.name)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  const handleView = (role: Role) => {
    setViewingRole(role);
    setIsViewDrawerVisible(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      name: role.name,
      content: role.content,
    });
    setIsModalVisible(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({
      content: DEFAULT_ROLE_TEMPLATE,
    });
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: { name: string; content: string }) => {
    await upsertMutation.mutateAsync(values);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">角色管理</h1>
        <Space>
          <Input
            placeholder="搜索角色..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <PermissionGuard resource="roles" action="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建角色
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="name"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个角色`,
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新建角色'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingRole(null);
          form.resetFields();
        }}
        okText={editingRole ? '更新' : '创建'}
        cancelText="取消"
        width={800}
        confirmLoading={upsertMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="角色名"
            rules={[{ required: true, message: '请输入角色名' }]}
          >
            <Input
              placeholder="请输入角色名"
              disabled={!!editingRole}
            />
          </Form.Item>

          <Form.Item
            name="content"
            label="角色定义 (YAML)"
            rules={[{ required: true, message: '请输入角色定义' }]}
          >
            <Input.TextArea
              rows={20}
              placeholder="请输入 YAML 格式的角色定义"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看详情抽屉 */}
      <Drawer
        title={`角色详情: ${viewingRole?.name}`}
        placement="right"
        width={600}
        open={isViewDrawerVisible}
        onClose={() => {
          setIsViewDrawerVisible(false);
          setViewingRole(null);
        }}
      >
        {viewingRole && (
          <div>
            <div className="mb-4">
              <div className="text-gray-500 mb-1">ID</div>
              <div className="font-mono text-sm">{viewingRole.id}</div>
            </div>
            <div className="mb-4">
              <div className="text-gray-500 mb-1">类型</div>
              <Tag>{viewingRole.kind}</Tag>
            </div>
            <div>
              <div className="text-gray-500 mb-1">定义</div>
              <pre
                className="bg-gray-100 p-4 rounded overflow-auto"
                style={{ maxHeight: '60vh' }}
              >
                <code>{viewingRole.content}</code>
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

const DEFAULT_ROLE_TEMPLATE = `kind: role
metadata:
  name: my-role
  description: My custom role
spec:
  allow:
    logins:
      - '{{internal.logins}}'
    node_labels:
      '*': '*'
    rules:
      - resources:
          - event
        verbs:
          - list
          - read
  deny: {}
  options:
    cert_format: standard
    max_session_ttl: 30h0m0s
    port_forwarding: true
version: v3
`;
