import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Card, message, Spin, Divider, Typography } from 'antd';
import { UserOutlined, LockOutlined, ScanOutlined, GoogleOutlined, GithubOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/client';
import type { AuthenticationSettings, U2FSignResponse } from '../types/api';

const { Text } = Typography;

export const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [authSettings, setAuthSettings] = useState<AuthenticationSettings | null>(null);
  const [authSettingsLoading, setAuthSettingsLoading] = useState(true);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsU2F, setNeedsU2F] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ username: string; password: string } | null>(null);
  const [u2fChallenge, setU2fChallenge] = useState<any>(null);

  // 获取认证设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const ping = await authApi.getAuthSettings();
        setAuthSettings(ping.auth);
      } catch (error) {
        console.error('Failed to fetch auth settings:', error);
      } finally {
        setAuthSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // 处理强制登出
  useEffect(() => {
    if (searchParams.get('forceLogout') || searchParams.get('logout')) {
      clearAuth();
      localStorage.removeItem('csrf_token');
    }
  }, [searchParams, clearAuth]);

  // 第一步：用户名/密码登录
  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      const errorMsg = error.message || '';
      
      // 检查是否需要 U2F
      if (errorMsg.toLowerCase().includes('u2f') || 
          errorMsg.toLowerCase().includes('webauthn') ||
          (authSettings?.second_factor === 'u2f' || authSettings?.second_factor === 'on')) {
        setNeedsU2F(true);
        setPendingCredentials({ username: values.username, password: values.password });
        
        // 获取 U2F 挑战
        try {
          const challenge = await authApi.getMFAChallenge({
            user: values.username,
            pass: values.password,
          });
          setU2fChallenge(challenge);
          message.info('请使用 U2F 安全密钥完成认证');
          
          // 自动开始 U2F 认证
          startU2FAuthentication(values.username, challenge);
        } catch (u2fError: any) {
          message.error(u2fError.message || '获取 U2F 挑战失败');
        }
      }
      // 检查是否需要 OTP
      else if (errorMsg.toLowerCase().includes('second factor') || 
          errorMsg.toLowerCase().includes('mfa') ||
          errorMsg.toLowerCase().includes('totp') ||
          errorMsg.toLowerCase().includes('otp')) {
        setNeeds2FA(true);
        setPendingCredentials({ username: values.username, password: values.password });
        message.info('请输入双因素认证验证码');
      } else {
        message.error(errorMsg || '登录失败，请检查用户名和密码');
      }
    } finally {
      setLoading(false);
    }
  };

  // U2F 认证流程
  const startU2FAuthentication = async (username: string, challenge: any) => {
    try {
      // 检查浏览器是否支持 WebAuthn
      if (!window.PublicKeyCredential) {
        message.error('您的浏览器不支持 WebAuthn/U2F');
        return;
      }

      // 构建 WebAuthn 认证选项
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64ToArrayBuffer(challenge.challenge),
        allowCredentials: challenge.keyHandle ? [{
          id: base64ToArrayBuffer(challenge.keyHandle),
          type: 'public-key',
        }] : [],
        userVerification: 'discouraged',
        timeout: 60000,
      };

      // 调用 WebAuthn API
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('U2F 认证被取消');
      }

      // 构建签名响应
      const response = assertion.response as AuthenticatorAssertionResponse;
      const u2fSignResponse: U2FSignResponse = {
        signatureData: arrayBufferToBase64(response.signature),
        clientData: arrayBufferToBase64(response.clientDataJSON),
        challenge: challenge.challenge,
      };

      // 发送 U2F 签名到后端
      await authApi.createSessionWithU2F({
        user: username,
        u2f_sign_response: u2fSignResponse,
      });

      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.message || 'U2F 认证失败');
      setNeedsU2F(false);
      setU2fChallenge(null);
    }
  };

  // Base64 转 ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // ArrayBuffer 转 Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // 第二步：2FA 验证码
  const handle2FA = async (values: { token: string }) => {
    if (!pendingCredentials) {
      message.error('请先输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      await login(
        pendingCredentials.username,
        pendingCredentials.password,
        values.token
      );
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.message || '验证码错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // SSO 登录重定向
  const handleSSOLogin = (type: 'oidc' | 'saml' | 'github', connectorName: string) => {
    // 构建回调 URL（使用统一的回调页面）
    const callbackUrl = `${window.location.origin}/auth/callback`;
    // 编码 state 参数，包含类型信息
    const stateData = btoa(JSON.stringify({ type, connector: connectorName, ts: Date.now() }));
    let ssoUrl = '';

    switch (type) {
      case 'oidc':
        ssoUrl = `/webapi/oidc/login/web?redirect_url=${encodeURIComponent(callbackUrl)}&connector_id=${connectorName}&state=${stateData}`;
        break;
      case 'saml':
        ssoUrl = `/webapi/saml/sso?redirect_url=${encodeURIComponent(callbackUrl)}&connector_id=${connectorName}&state=${stateData}`;
        break;
      case 'github':
        ssoUrl = `/webapi/github/login/web?redirect_url=${encodeURIComponent(callbackUrl)}&connector_id=${connectorName}&state=${stateData}`;
        break;
    }

    window.location.href = ssoUrl;
  };

  const isLocalAuthAvailable = authSettings?.type === 'local' || 
    (authSettings?.local && authSettings.local.name);

  if (authSettingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Spin size="large" tip="加载认证配置..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card
        title={
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Siriusec</h1>
            <p className="text-gray-500 text-sm mt-1">安全访问管理平台</p>
          </div>
        }
        className="w-full max-w-md shadow-lg"
      >
        {/* 本地认证表单 */}
        {isLocalAuthAvailable && !needs2FA && (
          <Form
            name="login"
            initialValues={{ remember: true }}
            onFinish={handleLogin}
            autoComplete="off"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>

            <Form.Item>
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="link"
                  onClick={() => navigate('/forgot-password')}
                  style={{ padding: 0 }}
                >
                  忘记密码？
                </Button>
              </div>
            </Form.Item>
          </Form>
        )}

        {/* 2FA 验证码输入 */}
        {needs2FA && (
          <Form
            name="2fa"
            onFinish={handle2FA}
            autoComplete="off"
            layout="vertical"
          >
            <div className="text-center mb-4">
              <ScanOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              <p className="mt-2 text-gray-600">双因素认证</p>
              <Text type="secondary" style={{ fontSize: 12 }}>
                请输入您的认证应用（如 Google Authenticator）生成的 6 位验证码
              </Text>
            </div>

            <Form.Item
              name="token"
              rules={[
                { required: true, message: '请输入验证码' },
                { len: 6, message: '验证码为 6 位数字' },
                { pattern: /^\d{6}$/, message: '验证码必须为数字' },
              ]}
            >
              <Input.OTP
                length={6}
                size="large"
                className="text-center"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                验证
              </Button>
            </Form.Item>

            <Form.Item>
              <Button
                type="link"
                onClick={() => {
                  setNeeds2FA(false);
                  setPendingCredentials(null);
                }}
                block
              >
                返回重新输入用户名/密码
              </Button>
            </Form.Item>
          </Form>
        )}

        {/* SSO 登录选项 */}
        {(authSettings?.oidc?.length > 0 || 
          authSettings?.saml?.length > 0 || 
          authSettings?.github?.length > 0) && (
          <>
            {isLocalAuthAvailable && !needs2FA && <Divider>或使用以下方式登录</Divider>}
            
            <div className="flex flex-col gap-2">
              {authSettings.oidc?.map((connector) => (
                <Button
                  key={`oidc-${connector.name}`}
                  icon={<GoogleOutlined />}
                  size="large"
                  block
                  onClick={() => handleSSOLogin('oidc', connector.name)}
                >
                  {connector.display || connector.name} (OIDC)
                </Button>
              ))}

              {authSettings.saml?.map((connector) => (
                <Button
                  key={`saml-${connector.name}`}
                  icon={<ScanOutlined />}
                  size="large"
                  block
                  onClick={() => handleSSOLogin('saml', connector.name)}
                >
                  {connector.display || connector.name} (SAML)
                </Button>
              ))}

              {authSettings.github?.map((connector) => (
                <Button
                  key={`github-${connector.name}`}
                  icon={<GithubOutlined />}
                  size="large"
                  block
                  onClick={() => handleSSOLogin('github', connector.name)}
                >
                  {connector.display || connector.name} (GitHub)
                </Button>
              ))}
            </div>
          </>
        )}

        {!isLocalAuthAvailable && !needs2FA && !needsU2F && (
          <div className="text-center mt-4">
            <Text type="secondary">请使用下方的 SSO 方式登录</Text>
          </div>
        )}
      </Card>
    </div>
  );
};
