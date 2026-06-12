import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, Spin, message, Result, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { authApi, setBearerToken } from '../api/client';
import { useAuthStore } from '../stores/authStore';

export const SSOCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { fetchUserContext } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // 获取回调参数
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // 检查是否有错误
        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // 判断回调类型
        const path = location.pathname;
        const stateParam = searchParams.get('state');
        let callbackUrl = '';

        // 从 state 参数解析回调类型
        let connectorType = '';
        if (stateParam) {
          try {
            const stateData = JSON.parse(atob(stateParam));
            connectorType = stateData.type || '';
          } catch (e) {
            // state 不是 base64 编码，直接检查
            if (stateParam.includes('oidc')) connectorType = 'oidc';
            else if (stateParam.includes('saml')) connectorType = 'saml';
            else if (stateParam.includes('github')) connectorType = 'github';
          }
        }

        if (path.includes('/oidc/callback') || connectorType === 'oidc') {
          callbackUrl = '/webapi/oidc/callback';
        } else if (path.includes('/saml/acs') || connectorType === 'saml') {
          callbackUrl = '/webapi/saml/acs';
        } else if (path.includes('/github/callback') || connectorType === 'github') {
          callbackUrl = '/webapi/github/callback';
        } else {
          // 通用回调处理
          callbackUrl = '/webapi/sessions/web';
        }

        // 构建回调请求
        const params = new URLSearchParams();
        if (code) params.append('code', code);
        if (state) params.append('state', state);

        // 调用后端回调 API
        const response = await fetch(`${callbackUrl}?${params.toString()}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'SSO 认证失败');
        }

        const data = await response.json();

        // 保存 bearer token 到内存（防止 XSS 攻击）
        if (data.token) {
          setBearerToken(data.token);
        }
        if (data.csrfToken) {
          localStorage.setItem('csrf_token', data.csrfToken);
        }
        
        // 获取用户上下文
        await fetchUserContext(data.clusterName || '-current-');
        
        setSuccess(true);
        message.success('登录成功');
        
        // 延迟跳转
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } catch (err: any) {
        console.error('SSO callback error:', err);
        setError(err.message || 'SSO 认证失败');
        message.error(err.message || 'SSO 认证失败');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, location.pathname, navigate, fetchUserContext]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在处理 SSO 认证...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md shadow-lg">
          <Result
            status="error"
            icon={<CloseCircleOutlined />}
            title="SSO 认证失败"
            subTitle={error}
            extra={[
              <Button type="primary" onClick={() => navigate('/login')}>
                返回登录页
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Card className="w-full max-w-md shadow-lg">
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="登录成功"
            subTitle="正在跳转到首页..."
          />
        </Card>
      </div>
    );
  }

  return null;
};

export default SSOCallback;
