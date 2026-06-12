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
  Select,
  message,
  Popconfirm,
} from 'antd';
import {
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '../api/client';
import type { User, Role, ResetPasswordToken } from '../types/api';
import { PermissionGuard } from '../components/PermissionGuard';
import InviteLinkModal from '../components/InviteLinkModal';

const { Option } = Select;

export const Users = () => {
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    visible: boolean;
    username: string;
    tokenId: string;
    expiry?: string;
  }>({ visible: false, username: '', tokenId: '' });
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取用户列表
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.getUsers();
      return res as { items: User[] };
    },
  });
  const users = Array.isArray(usersData) ? usersData : usersData?.items || [];

  // 获取角色列表
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getRoles();
      return res as { items: Role[] };
    },
  });
  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // 创建用户
  const createMutation = useMutation({
    mutationFn: (values: { name: string; roles: string[] }) =>
      usersApi.createUser(values),
    onSuccess: (_data, variables) => {
      message.success('用户创建成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalVisible(false);
      form.resetFields();

      // 创建邀请令牌
      generateInviteToken(variables.name);
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    },
  });

  // 生成邀请令牌
  const generateInviteToken = async (username: string) => {
    try {
      const token = await usersApi.createResetPasswordToken({
        name: username,
        type: 'invite',
      });

      setInviteInfo({
        visible: true,
        username,
        tokenId: token.tokenId,
        expiry: token.expiry,
      });
    } catch (error: any) {
      console.error('Failed to create invite token:', error);
      message.error('邀请令牌生成失败');
    }
  };

  // 为现有用户重新生成邀请令牌
  const handleRegenerateInvite = async (username: string) => {
    await generateInviteToken(username);
  };

  // 更新用户
  const updateMutation = useMutation({
    mutationFn: (values: { name: string; roles: string[] }) =>
      usersApi.updateUser(values),
    onSuccess: () => {
      message.success('用户更新成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalVisible(false);
      setEditingUser(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '更新失败');
    },
  });

  // 删除用户
  const deleteMutation = useMutation({
    mutationFn: (username: string) => usersApi.deleteUser(username),
    onSuccess: () => {
      message.success('用户删除成功');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.message || '删除失败');
    },
  });

  const filteredUsers = users.filter(
    (user) => {
      const name = user.name?.toLowerCase() || '';
      const roles = user.roles || [];
      return name.includes(searchText.toLowerCase()) ||
        roles.some((r) => r.toLowerCase().includes(searchText.toLowerCase()));
    }
  );

  const columns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <TeamOutlined />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: '认证类型',
      dataIndex: 'authType',
      key: 'authType',
      render: (type: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          local: { text: '本地', color: 'blue' },
          oidc: { text: 'OIDC', color: 'green' },
          saml: { text: 'SAML', color: 'purple' },
          github: { text: 'GitHub', color: 'black' },
        };
        const { text, color } = typeMap[type] || { text: type, color: 'gray' };
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue">
              {role}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <PermissionGuard resource="users" action="edit">
            <Button
              type="text"
              icon={<LinkOutlined />}
              onClick={() => handleRegenerateInvite(record.name)}
            >
              邀请
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="users" action="edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
          </PermissionGuard>
          <PermissionGuard resource="users" action="delete">
            <Popconfirm
              title="确认删除"
              description={`确定要删除用户 "${record.name}" 吗？`}
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

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      name: user.name,
      roles: user.roles,
    });
    setIsModalVisible(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleSubmit = async (values: { name: string; roles: string[] }) => {
    if (editingUser) {
      await updateMutation.mutateAsync(values);
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const isLoading = usersLoading || rolesLoading;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <Space>
          <Input
            placeholder="搜索用户..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <PermissionGuard resource="users" action="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建用户
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="name"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个用户`,
          }}
        />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        okText={editingUser ? '更新' : '创建'}
        cancelText="取消"
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              placeholder="请输入用户名"
              disabled={!!editingUser}
            />
          </Form.Item>

          <Form.Item
            name="roles"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择角色"
              loading={rolesLoading}
            >
              {roles.map((role) => (
                <Option key={role.name} value={role.name}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 邀请链接弹窗 */}
      <InviteLinkModal
        visible={inviteInfo.visible}
        username={inviteInfo.username}
        tokenId={inviteInfo.tokenId}
        expiry={inviteInfo.expiry}
        onClose={() => setInviteInfo({ visible: false, username: '', tokenId: '' })}
      />
    </div>
  );
};
