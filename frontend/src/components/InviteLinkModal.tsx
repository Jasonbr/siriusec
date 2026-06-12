import React, { useState } from 'react';
import { Modal, Button, Input, Space, message, QRCode } from 'antd';
import { CopyOutlined, LinkOutlined } from '@ant-design/icons';

interface InviteLinkModalProps {
  visible: boolean;
  username: string;
  tokenId: string;
  expiry?: string;
  onClose: () => void;
}

const InviteLinkModal: React.FC<InviteLinkModalProps> = ({
  visible,
  username,
  tokenId,
  expiry,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // 构建邀请链接
  const inviteUrl = `${window.location.origin}/reset-password?token=${tokenId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      message.success('邀请链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const handleOpenLink = () => {
    window.open(inviteUrl, '_blank');
  };

  // 格式化过期时间
  const expiryDate = expiry ? new Date(expiry) : null;
  const expiryText = expiryDate
    ? `过期时间：${expiryDate.toLocaleString('zh-CN')}`
    : '';

  return (
    <Modal
      title="用户邀请链接"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <p>
            <strong>用户：</strong>
            {username}
          </p>
          <p>{expiryText}</p>
          <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
            请将此链接发送给用户，用户点击后可设置密码。链接过期后需要重新生成。
          </p>
        </div>

        <div>
          <p>
            <strong>邀请链接：</strong>
          </p>
          <Input.Group compact>
            <Input
              style={{ width: 'calc(100% - 120px)' }}
              value={inviteUrl}
              readOnly
            />
            <Button
              type="primary"
              icon={<CopyOutlined />}
              onClick={handleCopy}
            >
              {copied ? '已复制' : '复制'}
            </Button>
          </Input.Group>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p>
            <strong>二维码：</strong>
          </p>
          <QRCode value={inviteUrl} size={160} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={handleOpenLink}
          >
            在新窗口打开
          </Button>
        </div>
      </Space>
    </Modal>
  );
};

export default InviteLinkModal;
