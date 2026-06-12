import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  List,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tabs,
  QRCode,
  Typography,
  Spin,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SafetyOutlined,
  UsbOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import { authApi } from '../api/client';
import type { MFADevice, AddTOTPDeviceResponse, AddU2FDeviceResponse } from '../types/api';

const { Text, Title } = Typography;
const { TabPane } = Tabs;

interface MFADevicesManagerProps {
  userName: string;
}

export const MFADevicesManager: React.FC<MFADevicesManagerProps> = ({ userName }) => {
  const [devices, setDevices] = useState<MFADevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('totp');

  // TOTP 添加状态
  const [totpForm] = Form.useForm();
  const [totpResponse, setTotpResponse] = useState<AddTOTPDeviceResponse | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpVerifyCode, setTotpVerifyCode] = useState('');

  // U2F 添加状态
  const [u2fForm] = Form.useForm();
  const [u2fResponse, setU2fResponse] = useState<AddU2FDeviceResponse | null>(null);
  const [u2fLoading, setU2fLoading] = useState(false);
  const [u2fRegistering, setU2fRegistering] = useState(false);

  // 加载 MFA 设备列表
  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await authApi.getMFADevices();
      setDevices(data);
    } catch (error: any) {
      console.error('Failed to load MFA devices:', error);
      // 如果 API 不存在，显示空列表
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // 删除设备
  const handleDelete = async (deviceId: string) => {
    try {
      await authApi.removeMFADevice(deviceId);
      message.success('设备已删除');
      loadDevices();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 添加 TOTP 设备
  const handleAddTOTP = async (values: { name: string }) => {
    setTotpLoading(true);
    try {
      const response = await authApi.addTOTPDevice({ name: values.name });
      setTotpResponse(response);
      message.success('请扫描二维码并输入验证码完成注册');
    } catch (error: any) {
      message.error(error.message || '添加失败');
    } finally {
      setTotpLoading(false);
    }
  };

  // 验证 TOTP 码
  const handleVerifyTOTP = async () => {
    if (!totpResponse || !totpVerifyCode) return;

    try {
      await authApi.verifyTOTP({
        token: totpResponse.secret,
        code: totpVerifyCode,
      });
      message.success('TOTP 设备添加成功');
      setIsAddModalVisible(false);
      setTotpResponse(null);
      setTotpVerifyCode('');
      totpForm.resetFields();
      loadDevices();
    } catch (error: any) {
      message.error(error.message || '验证码错误');
    }
  };

  // 添加 U2F 设备
  const handleAddU2F = async (values: { name: string }) => {
    setU2fLoading(true);
    try {
      const response = await authApi.addU2FDevice({ name: values.name });
      setU2fResponse(response);
      message.success('请插入 U2F 设备并触摸以完成注册');

      // 自动开始 U2F 注册流程
      startU2FRegistration(values.name, response);
    } catch (error: any) {
      message.error(error.message || '添加失败');
    } finally {
      setU2fLoading(false);
    }
  };

  // U2F 注册流程
  const startU2FRegistration = async (name: string, challengeData: AddU2FDeviceResponse) => {
    setU2fRegistering(true);
    try {
      // 检查浏览器是否支持 WebAuthn/U2F
      if (!window.PublicKeyCredential) {
        message.error('您的浏览器不支持 WebAuthn/U2F');
        return;
      }

      // 构建 WebAuthn 注册选项
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64ToArrayBuffer(challengeData.challenge.challenge),
        rp: {
          name: 'Siriusec',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(userName),
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        timeout: 60000,
        excludeCredentials: [],
        authenticatorSelection: {
          authenticatorAttachment: 'cross-platform',
          userVerification: 'discouraged',
        },
        attestation: 'direct',
      };

      // 调用 WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('U2F 注册被取消');
      }

      // 构建注册响应
      const response = credential.response as AuthenticatorAttestationResponse;
      await authApi.registerU2FDevice({
        name,
        u2f_register_response: {
          registrationData: arrayBufferToBase64(response.attestationObject),
          clientData: arrayBufferToBase64(response.clientDataJSON),
          challenge: challengeData.challenge.challenge,
        },
      });

      message.success('U2F 设备添加成功');
      setIsAddModalVisible(false);
      setU2fResponse(null);
      u2fForm.resetFields();
      loadDevices();
    } catch (error: any) {
      message.error(error.message || 'U2F 注册失败');
    } finally {
      setU2fRegistering(false);
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

  // 关闭添加 Modal
  const handleCloseAddModal = () => {
    setIsAddModalVisible(false);
    setTotpResponse(null);
    setU2fResponse(null);
    setTotpVerifyCode('');
    totpForm.resetFields();
    u2fForm.resetFields();
  };

  // 获取设备图标
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'totp':
        return <MobileOutlined />;
      case 'u2f':
      case 'webauthn':
        return <UsbOutlined />;
      default:
        return <SafetyOutlined />;
    }
  };

  // 获取设备类型标签
  const getDeviceTypeLabel = (type: string) => {
    switch (type) {
      case 'totp':
        return <Tag color="blue">TOTP</Tag>;
      case 'u2f':
        return <Tag color="green">U2F</Tag>;
      case 'webauthn':
        return <Tag color="purple">WebAuthn</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  return (
    <Card title="双因素认证设备" loading={loading}>
      {devices.length === 0 ? (
        <Empty
          description="暂无 MFA 设备"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={devices}
          renderItem={(device) => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(device.id)}
                >
                  删除
                </Button>,
              ]}
            >
              <List.Item.Meta
                avatar={getDeviceIcon(device.type)}
                title={
                  <Space>
                    <Text strong>{device.name}</Text>
                    {getDeviceTypeLabel(device.type)}
                  </Space>
                }
                description={`添加时间: ${new Date(device.addedAt).toLocaleString()}`}
              />
            </List.Item>
          )}
        />
      )}

      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={() => setIsAddModalVisible(true)}
        style={{ marginTop: 16 }}
      >
        添加 MFA 设备
      </Button>

      {/* 添加设备 Modal */}
      <Modal
        title="添加双因素认证设备"
        open={isAddModalVisible}
        onCancel={handleCloseAddModal}
        footer={null}
        width={600}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <Space>
                <MobileOutlined />
                TOTP (认证应用)
              </Space>
            }
            key="totp"
          >
            {!totpResponse ? (
              <Form form={totpForm} onFinish={handleAddTOTP} layout="vertical">
                <Form.Item
                  name="name"
                  label="设备名称"
                  rules={[{ required: true, message: '请输入设备名称' }]}
                >
                  <Input placeholder="例如: 我的手机" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={totpLoading}
                    block
                  >
                    生成二维码
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ textAlign: 'center' }}>
                  <Title level={5}>扫描二维码</Title>
                  <Text type="secondary">
                    使用 Google Authenticator 或类似应用扫描
                  </Text>
                  <div style={{ marginTop: 16 }}>
                    <QRCode value={totpResponse.qrCode} size={200} />
                  </div>
                </div>

                <div>
                  <Title level={5}>验证验证码</Title>
                  <Input
                    placeholder="输入 6 位验证码"
                    value={totpVerifyCode}
                    onChange={(e) => setTotpVerifyCode(e.target.value)}
                    maxLength={6}
                  />
                  <Button
                    type="primary"
                    onClick={handleVerifyTOTP}
                    disabled={totpVerifyCode.length !== 6}
                    style={{ marginTop: 16 }}
                    block
                  >
                    验证并添加
                  </Button>
                </div>
              </Space>
            )}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <UsbOutlined />
                U2F / WebAuthn
              </Space>
            }
            key="u2f"
          >
            {!u2fResponse ? (
              <Form form={u2fForm} onFinish={handleAddU2F} layout="vertical">
                <Form.Item
                  name="name"
                  label="设备名称"
                  rules={[{ required: true, message: '请输入设备名称' }]}
                >
                  <Input placeholder="例如: YubiKey" />
                </Form.Item>
                <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
                  请插入您的 U2F 安全密钥（如 YubiKey），然后点击开始注册
                </Text>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={u2fLoading}
                    block
                  >
                    开始注册
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Spin size="large" tip="等待 U2F 设备..." spinning={u2fRegistering}>
                  <UsbOutlined style={{ fontSize: 64, color: '#1890ff' }} />
                  <Title level={4} style={{ marginTop: 16 }}>
                    请触摸您的 U2F 设备
                  </Title>
                  <Text type="secondary">
                    按照设备上的指示完成注册
                  </Text>
                </Spin>
              </div>
            )}
          </TabPane>
        </Tabs>
      </Modal>
    </Card>
  );
};

export default MFADevicesManager;
