import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi, authApi } from '../api/client';
import type { ResetPasswordToken } from '../types/api';

const { Title, Text } = Typography;

interface PasswordFormValues {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<PasswordFormValues>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<ResetPasswordToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('无效的邀请链接：缺少 token 参数');
      setLoading(false);
      return;
    }

    // 获取令牌详情
    usersApi
      .getResetPasswordToken(token)
      .then((info) => {
        setTokenInfo(info);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch token info:', err);
        setError(err.message || '邀请链接无效或已过期');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (values: PasswordFormValues) => {
    if (!token) {
      message.error('邀请链接无效');
      return;
    }

    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    // 密码强度检查（与后端 VerifyPassword 保持一致）
    if (values.password.length < 12) {
      message.error('密码长度至少为 12 位');
      return;
    }
    if (!/[A-Z]/.test(values.password)) {
      message.error('密码必须包含至少一个大写字母');
      return;
    }
    if (!/[a-z]/.test(values.password)) {
      message.error('密码必须包含至少一个小写字母');
      return;
    }
    if (!/\d/.test(values.password)) {
      message.error('密码必须包含至少一个数字');
      return;
    }

    setSubmitting(true);
    try {
      // 先获取 CSRF token（密码重置页面未登录，需要手动获取）
      const csrfToken = await authApi.getCsrfToken();
      localStorage.setItem('csrf_token', csrfToken);

      // 将密码转换为 base64
      const passwordBase64 = btoa(unescape(encodeURIComponent(values.password)));

      await usersApi.changePasswordWithToken({
        token,
        password: passwordBase64,
      });

      message.success('密码设置成功，正在跳转到登录页...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: unknown) {
      console.error('Failed to set password:', err);
      const errorMessage = err instanceof Error ? err.message : '密码设置失败，请重试';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>验证邀请链接...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 400, margin: '100px auto', padding: '0 16px' }}>
        <Card>
          <Alert
            type="error"
            message="邀请链接无效"
            description={error}
            showIcon
          />
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/login')}
            block
          >
            返回登录页
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: '50px auto', padding: '0 16px' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>设置密码</Title>
          {tokenInfo && (
            <Text>
              <UserOutlined /> 用户：{tokenInfo.user}
            </Text>
          )}
        </div>

        <Form
          form={form}
          name="resetPassword"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 12, message: '密码长度至少为 12 位' },
              { pattern: /[A-Z]/, message: '密码必须包含至少一个大写字母' },
              { pattern: /[a-z]/, message: '密码必须包含至少一个小写字母' },
              { pattern: /\d/, message: '密码必须包含至少一个数字' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认新密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
            >
              设置密码
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Button type="link" onClick={() => navigate('/login')}>
            返回登录
          </Button>
        </div>
      </Card>
    </div>
  );
};

export { ResetPassword };
