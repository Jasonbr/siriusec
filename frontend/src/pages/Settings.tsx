import { useState } from 'react';
import { Card, Form, Input, Button, message, Divider, Tag, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined, CheckCircleOutlined, CloseCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { usersApi } from '../api/client';
import { MFADevicesManager } from '../components/MFADevicesManager';
import type { ChangePasswordRequest } from '../types/api';

const { Title, Text } = Typography;

export const Settings = () => {
  const { user } = useAuthStore();
  const [passwordForm] = Form.useForm();
  const [passwordStrength, setPasswordStrength] = useState(0);

  const username = user?.userName || localStorage.getItem('username') || 'admin';
  const authType = user?.authType || 'local';
  const roles = user?.userAcl ? Object.keys(user.userAcl).filter(key => {
    const acl = user.userAcl[key as keyof typeof user.userAcl];
    return typeof acl === 'object' && 'list' in acl && acl.list !== false;
  }).slice(0, 5) || [] : [];

  // 密码强度计算
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 1;
    return Math.min(strength, 5);
  };

  const handlePasswordChange = (values: any) => {
    setPasswordStrength(calculatePasswordStrength(values.new_password));
  };

  // 修改密码 mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (request: ChangePasswordRequest) => {
      return await usersApi.changePassword(request);
    },
    onSuccess: () => {
      message.success('密码修改成功');
      passwordForm.resetFields();
      setPasswordStrength(0);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error?.message || error.message || '密码修改失败';
      message.error(errorMsg);
    },
  });

  const handleSubmitPassword = (values: any) => {
    if (values.new_password !== values.confirm_password) {
      message.error('两次输入的密码不一致');
      return;
    }

    const request: ChangePasswordRequest = {
      old_password: btoa(values.old_password),
      new_password: btoa(values.new_password),
    };

    changePasswordMutation.mutate(request);
  };

  const getStrengthInfo = (strength: number) => {
    if (strength <= 1) return { text: '弱', color: 'red', icon: <CloseCircleOutlined /> };
    if (strength <= 3) return { text: '中', color: 'orange', icon: null };
    return { text: '强', color: 'green', icon: <CheckCircleOutlined /> };
  };

  const strengthInfo = getStrengthInfo(passwordStrength);

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        用户设置
      </Title>

      {/* 个人信息 */}
      <Card 
        title="个人信息"
        style={{ marginBottom: 24 }}
      >
        <Form layout="vertical">
          <Form.Item label="用户名">
            <Input 
              value={username} 
              disabled 
              prefix={<UserOutlined />}
            />
          </Form.Item>
          
          <Form.Item label="认证类型">
            <Input 
              value={authType === 'local' ? '本地认证' : authType.toUpperCase()} 
              disabled 
            />
          </Form.Item>

          <Form.Item label="角色">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {roles.length > 0 ? (
                roles.map(role => (
                  <Tag key={role} color="blue">{role}</Tag>
                ))
              ) : (
                <Text type="secondary">无角色信息</Text>
              )}
            </div>
          </Form.Item>
        </Form>
      </Card>

      {/* 密码修改 - 仅本地认证用户可见 */}
      {authType === 'local' && (
        <Card title="修改密码">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleSubmitPassword}
            onValuesChange={handlePasswordChange}
            autoComplete="off"
          >
            <Form.Item
              name="old_password"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />}
                placeholder="请输入当前密码"
              />
            </Form.Item>

            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 8, message: '密码长度至少 8 个字符' },
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />}
                placeholder="请输入新密码（至少 8 个字符）"
              />
            </Form.Item>

            {passwordStrength > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text type="secondary">密码强度:</Text>
                <Tag color={strengthInfo.color} icon={strengthInfo.icon}>
                  {strengthInfo.text}
                </Tag>
              </div>
            )}

            <Form.Item
              name="confirm_password"
              label="确认新密码"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />}
                placeholder="请再次输入新密码"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={changePasswordMutation.isPending}
                style={{ minWidth: 120 }}
              >
                修改密码
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}

      {authType !== 'local' && (
        <Card>
          <Text type="secondary">
            您通过 SSO 登录，无法在此处修改密码。请联系您的身份提供商进行管理。
          </Text>
        </Card>
      )}

      {/* MFA 设备管理 - 仅本地认证用户可见 */}
      {authType === 'local' && (
        <MFADevicesManager userName={username} />
      )}
    </div>
  );
};
