import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Alert, Steps } from 'antd';
import { UserOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usersApi } from '../api/client';

const { Title, Text, Paragraph } = Typography;

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [form] = Form.useForm<{ username: string }>();
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // 步骤 1: 输入用户名
  const handleRequestReset = async (values: { username: string }) => {
    if (!isAuthenticated) {
      // 未登录用户：显示提示信息
      message.info('请联系管理员重置密码');
      setStep(1);
      return;
    }

    // 已登录管理员：直接生成重置链接
    setLoading(true);
    try {
      const response = await usersApi.createResetPasswordToken({
        name: values.username,
        type: 'password',
      });

      // 构建重置链接
      const link = `${window.location.origin}/reset-password?token=${response.tokenId}`;
      setResetLink(link);
      setStep(2);
      message.success('重置链接已生成');
    } catch (error: any) {
      console.error('Failed to create reset token:', error);
      message.error(error.message || '生成重置链接失败');
    } finally {
      setLoading(false);
    }
  };

  // 复制链接到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('链接已复制到剪贴板');
    }).catch(() => {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success('链接已复制到剪贴板');
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card
        className="w-full max-w-md shadow-lg"
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3}>
            <SafetyOutlined style={{ marginRight: 8 }} />
            忘记密码
          </Title>
        </div>

        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: '输入用户名' },
            { title: '验证身份' },
            { title: '获取链接' },
          ]}
        />

        {/* 步骤 0: 输入用户名 */}
        {step === 0 && (
          <Form
            form={form}
            name="forgotPassword"
            onFinish={handleRequestReset}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
              >
                {isAuthenticated ? '生成重置链接' : '请求重置密码'}
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/login')}>
                返回登录
              </Button>
            </div>
          </Form>
        )}

        {/* 步骤 1: 未登录用户提示 */}
        {step === 1 && (
          <div>
            <Alert
              type="info"
              message="需要管理员协助"
              description={
                <div>
                  <Paragraph>
                    由于安全考虑，密码重置需要管理员操作。
                  </Paragraph>
                  <Paragraph>
                    <strong>请联系系统管理员</strong>，提供您的用户名，管理员将为您生成重置链接。
                  </Paragraph>
                  <Paragraph>
                    管理员可以使用以下命令生成重置链接：
                  </Paragraph>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                    overflow: 'auto',
                  }}>
                    <code>sctl users reset {'<用户名>'}</code>
                  </pre>
                </div>
              }
              showIcon
              icon={<MailOutlined />}
            />

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button
                type="primary"
                onClick={() => navigate('/login')}
                block
              >
                返回登录
              </Button>
            </div>
          </div>
        )}

        {/* 步骤 2: 已登录管理员显示链接 */}
        {step === 2 && resetLink && (
          <div>
            <Alert
              type="success"
              message="重置链接已生成"
              description={
                <div>
                  <Paragraph>
                    请将以下链接分享给用户，链接有效期为 <strong>8 小时</strong>：
                  </Paragraph>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: '8px 12px',
                    borderRadius: 4,
                    fontSize: 12,
                    wordBreak: 'break-all',
                    marginBottom: 8,
                  }}>
                    <code>{resetLink}</code>
                  </pre>
                  <Button
                    type="link"
                    onClick={() => copyToClipboard(resetLink)}
                    style={{ padding: 0 }}
                  >
                    复制链接
                  </Button>
                </div>
              }
              showIcon
            />

            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => {
                  setStep(0);
                  setResetLink(null);
                  form.resetFields();
                }}
                block
              >
                重置另一个用户
              </Button>
            </div>

            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/')}>
                返回首页
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export { ForgotPassword };
