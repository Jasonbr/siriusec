import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Switch,
  Button,
  message,
  Tabs,
  Select,
  InputNumber,
  Divider,
  Typography,
  Space,
  Alert,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { systemConfigApi } from '../api/client';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface SystemConfig {
  // 认证设置
  auth: {
    type: 'local' | 'oidc' | 'saml' | 'github';
    secondFactor: 'off' | 'otp' | 'u2f' | 'on';
    sessionTimeout: number; // 分钟
    idleTimeout: number; // 分钟
  };
  // 会话设置
  session: {
    maxConcurrent: number;
    recordingEnabled: boolean;
    joinAllowed: boolean;
  };
  // 网络设置
  network: {
    publicAddr: string;
    proxyListenerMode: 'multiplex' | 'separate';
    keepAliveInterval: number; // 秒
  };
  // 审计设置
  audit: {
    enabled: boolean;
    retentionDays: number;
    events: string[];
  };
}

const defaultConfig: SystemConfig = {
  auth: {
    type: 'local',
    secondFactor: 'off',
    sessionTimeout: 30,
    idleTimeout: 10,
  },
  session: {
    maxConcurrent: 10,
    recordingEnabled: true,
    joinAllowed: true,
  },
  network: {
    publicAddr: '',
    proxyListenerMode: 'multiplex',
    keepAliveInterval: 300,
  },
  audit: {
    enabled: true,
    retentionDays: 90,
    events: ['session.start', 'session.end', 'auth.login', 'auth.logout'],
  },
};

export const SystemSettings = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('auth');
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);

  // 获取系统配置
  const { data: systemConfig, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const config = await systemConfigApi.getConfig();
      return config as SystemConfig;
    },
  });

  useEffect(() => {
    if (systemConfig) {
      setConfig(systemConfig);
      form.setFieldsValue(systemConfig);
    }
  }, [systemConfig, form]);

  // 保存配置
  const saveMutation = useMutation({
    mutationFn: async (values: SystemConfig) => {
      await systemConfigApi.updateConfig(values);
      return values;
    },
    onSuccess: () => {
      message.success('配置保存成功');
    },
    onError: (error: any) => {
      message.error(error.message || '保存失败');
    },
  });

  const handleSave = (values: any) => {
    saveMutation.mutate(values as SystemConfig);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <div className="text-center py-12">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在加载配置...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card
        title={
          <Space>
            <SettingOutlined />
            <Title level={4} style={{ margin: 0 }}>系统设置</Title>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="系统设置"
          description="配置系统的全局参数，包括认证、会话、网络和审计设置。修改后需要重启服务才能生效。"
          className="mb-4"
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={config}
          onFinish={handleSave}
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane
              tab={
                <Space>
                  <SafetyOutlined />
                  认证设置
                </Space>
              }
              key="auth"
            >
              <Form.Item
                label="默认认证方式"
                name={['auth', 'type']}
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: '本地认证', value: 'local' },
                    { label: 'OIDC', value: 'oidc' },
                    { label: 'SAML', value: 'saml' },
                    { label: 'GitHub', value: 'github' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="双因素认证"
                name={['auth', 'secondFactor']}
                rules={[{ required: true }]}
              >
                <Select
                  options={[
                    { label: '关闭', value: 'off' },
                    { label: 'TOTP', value: 'otp' },
                    { label: 'U2F/WebAuthn', value: 'u2f' },
                    { label: '可选', value: 'on' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="会话超时（分钟）"
                name={['auth', 'sessionTimeout']}
                rules={[{ required: true, min: 5, max: 480 }]}
                extra="用户会话在多长时间后过期"
              >
                <InputNumber min={5} max={480} style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                label="空闲超时（分钟）"
                name={['auth', 'idleTimeout']}
                rules={[{ required: true, min: 1, max: 120 }]}
                extra="用户空闲多长时间后自动登出"
              >
                <InputNumber min={1} max={120} style={{ width: 200 }} />
              </Form.Item>
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <ClockCircleOutlined />
                  会话设置
                </Space>
              }
              key="session"
            >
              <Form.Item
                label="最大并发会话数"
                name={['session', 'maxConcurrent']}
                rules={[{ required: true, min: 1, max: 100 }]}
                extra="每个用户允许的最大并发会话数"
              >
                <InputNumber min={1} max={100} style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                label="启用会话录制"
                name={['session', 'recordingEnabled']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="允许加入会话"
                name={['session', 'joinAllowed']}
                valuePropName="checked"
                extra="允许用户加入其他用户的活跃会话"
              >
                <Switch />
              </Form.Item>
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <GlobalOutlined />
                  网络设置
                </Space>
              }
              key="network"
            >
              <Form.Item
                label="公共地址"
                name={['network', 'publicAddr']}
                extra="系统的公共访问地址，用于生成回调链接"
              >
                <Input placeholder="https://siriusec.example.com:443" />
              </Form.Item>

              <Form.Item
                label="代理监听模式"
                name={['network', 'proxyListenerMode']}
              >
                <Select
                  options={[
                    { label: '多路复用', value: 'multiplex' },
                    { label: '分离模式', value: 'separate' },
                  ]}
                />
              </Form.Item>

              <Form.Item
                label="Keep-Alive 间隔（秒）"
                name={['network', 'keepAliveInterval']}
                rules={[{ required: true, min: 30, max: 3600 }]}
              >
                <InputNumber min={30} max={3600} style={{ width: 200 }} />
              </Form.Item>
            </TabPane>

            <TabPane
              tab={
                <Space>
                  <SettingOutlined />
                  审计设置
                </Space>
              }
              key="audit"
            >
              <Form.Item
                label="启用审计日志"
                name={['audit', 'enabled']}
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="日志保留天数"
                name={['audit', 'retentionDays']}
                rules={[{ required: true, min: 7, max: 365 }]}
                extra="审计日志保留的天数，超过后将自动清理"
              >
                <InputNumber min={7} max={365} style={{ width: 200 }} />
              </Form.Item>
            </TabPane>
          </Tabs>

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
              >
                保存设置
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  message.info('已重置为上次保存的配置');
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SystemSettings;
