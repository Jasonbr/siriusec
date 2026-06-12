import { useState } from 'react';
import {
  Modal,
  Tabs,
  Form,
  Input,
  Button,
  Upload,
  message,
  Spin,
  Space,
  Descriptions,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { scpApi } from '../api/client';
import type { Node } from '../types/api';

interface FileTransferProps {
  node: Node | null;
  login: string;
  clusterName?: string;
  namespace?: string;
  visible: boolean;
  onClose: () => void;
}

export const FileTransfer = ({ node, login, clusterName = '-current-', namespace = 'default', visible, onClose }: FileTransferProps) => {
  const [activeTab, setActiveTab] = useState('download');
  const [downloadPath, setDownloadPath] = useState('/tmp/');
  const [uploadPath, setUploadPath] = useState('/tmp/');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleDownload = async () => {
    if (!node || !downloadPath) {
      message.error('请填写远程文件路径');
      return;
    }

    setIsDownloading(true);
    try {
      const blob = await scpApi.downloadFile(
        clusterName,
        namespace,
        node.id,
        login,
        downloadPath
      );

      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadPath.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success('文件下载成功');
    } catch (error: any) {
      console.error('Download failed:', error);
      message.error(error.message || '文件下载失败');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (!node || fileList.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    setIsUploading(true);
    try {
      const file = fileList[0].originFileObj;
      if (!file) {
        message.error('文件读取失败');
        return;
      }

      await scpApi.uploadFile(
        clusterName,
        namespace,
        node.id,
        login,
        uploadPath,
        file
      );

      message.success('文件上传成功');
      setFileList([]);
    } catch (error: any) {
      console.error('Upload failed:', error);
      message.error(error.message || '文件上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file: UploadFile) => {
      setFileList([file]);
      return false; // 阻止自动上传
    },
    fileList,
    maxCount: 1,
  };

  const items = [
    {
      key: 'download',
      label: '下载文件',
      children: (
        <Spin spinning={isDownloading}>
          <Space direction="vertical" className="w-full" size="large">
            <Descriptions bordered size="small">
              <Descriptions.Item label="服务器">
                {node?.hostname || node?.id}
              </Descriptions.Item>
              <Descriptions.Item label="登录用户">{login}</Descriptions.Item>
            </Descriptions>

            <Form layout="vertical">
              <Form.Item
                label="远程文件路径"
                required
                tooltip="要下载的远程服务器文件完整路径"
              >
                <Input
                  prefix={<FileOutlined />}
                  placeholder="例如: /tmp/example.txt"
                  value={downloadPath}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setDownloadPath(e.target.value)
                  }
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  loading={isDownloading}
                  block
                >
                  下载到本地
                </Button>
              </Form.Item>
            </Form>

            <div className="text-gray-500 text-sm">
              <p>提示:</p>
              <ul className="list-disc list-inside">
                <li>请确保文件路径存在且有读取权限</li>
                <li>大文件下载可能需要较长时间</li>
                <li>目录下载会自动打包为 tar.gz</li>
              </ul>
            </div>
          </Space>
        </Spin>
      ),
    },
    {
      key: 'upload',
      label: '上传文件',
      children: (
        <Spin spinning={isUploading}>
          <Space direction="vertical" className="w-full" size="large">
            <Descriptions bordered size="small">
              <Descriptions.Item label="服务器">
                {node?.hostname || node?.id}
              </Descriptions.Item>
              <Descriptions.Item label="登录用户">{login}</Descriptions.Item>
            </Descriptions>

            <Form layout="vertical">
              <Form.Item
                label="远程目标目录"
                required
                tooltip="文件将上传到此目录"
              >
                <Input
                  prefix={<FolderOutlined />}
                  placeholder="例如: /tmp/"
                  value={uploadPath}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setUploadPath(e.target.value)
                  }
                />
              </Form.Item>

              <Form.Item label="选择文件" required>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>选择文件</Button>
                </Upload>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={handleUpload}
                  loading={isUploading}
                  disabled={fileList.length === 0}
                  block
                >
                  上传到服务器
                </Button>
              </Form.Item>
            </Form>

            <div className="text-gray-500 text-sm">
              <p>提示:</p>
              <ul className="list-disc list-inside">
                <li>请确保目标目录存在且有写入权限</li>
                <li>同名文件将被覆盖</li>
                <li>单个文件大小限制为 100MB</li>
              </ul>
            </div>
          </Space>
        </Spin>
      ),
    },
  ];

  return (
    <Modal
      title="文件传输 (SCP)"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={null}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        className="mt-4"
      />
    </Modal>
  );
};
