import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  Input,
  Empty,
  Tooltip,
  Modal,
  Form,
  Select,
  message,
  Tabs,
  Alert,
} from 'antd';
import {
  CloudOutlined,
  CodeOutlined,
  CopyOutlined,
  SearchOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { kubernetesApi, clustersApi } from '../api/client';
import type { KubernetesCluster } from '../types/api';
import { useCluster } from '../hooks/useCluster';

const { TabPane } = Tabs;

export const Kubernetes = () => {
  const [searchText, setSearchText] = useState('');
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<KubernetesCluster | null>(null);
  const { clusterName } = useCluster();

  // 获取集群列表
  const { data: clustersData } = useQuery({
    queryKey: ['clusters'],
    queryFn: clustersApi.getClusters,
  });

  const clusters = clustersData?.items || [];
  const currentCluster = clusters[0]?.name || clusterName;

  // 获取 K8s 集群列表
  const { data: k8sData, isLoading } = useQuery({
    queryKey: ['kubernetes', currentCluster],
    queryFn: () => kubernetesApi.getClusters(currentCluster),
    enabled: !!currentCluster,
  });

  const k8sClusters: KubernetesCluster[] = Array.isArray(k8sData)
    ? k8sData
    : k8sData?.items || [];

  // 过滤集群
  const filteredClusters = k8sClusters.filter((k8s) => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      k8s.name.toLowerCase().includes(search) ||
      k8s.labels?.some((l) =>
        `${l.name}:${l.value}`.toLowerCase().includes(search)
      )
    );
  });

  const handleConnect = (cluster: KubernetesCluster) => {
    setSelectedCluster(cluster);
    setConnectModalVisible(true);
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command).then(() => {
      message.success('命令已复制到剪贴板');
    });
  };

  const generateKubeconfig = (clusterName: string) => {
    return `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://${currentCluster}:3026
    insecure-skip-tls-verify: true
  name: ${clusterName}
contexts:
- context:
    cluster: ${clusterName}
    user: siriusec-${clusterName}
  name: ${clusterName}
current-context: ${clusterName}
users:
- name: siriusec-${clusterName}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: tsh
      args:
      - kube
      - credentials
      - --kube-cluster=${clusterName}
      - --siriusec-cluster=${currentCluster}`;
  };

  const columns = [
    {
      title: '集群名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <CloudOutlined className="text-blue-500" />
          <span className="font-medium">{text}</span>
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels: KubernetesCluster['labels']) => (
        <Space size={[4, 4]} wrap>
          {labels?.map((label) => (
            <Tag key={`${label.name}:${label.value}`} className="text-xs">
              {label.name}: {label.value}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_: unknown, record: KubernetesCluster) => (
        <Space>
          <Tooltip title="生成 kubeconfig">
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => handleConnect(record)}
            >
              连接
            </Button>
          </Tooltip>
          <Tooltip title="kubectl 命令">
            <Button
              icon={<CodeOutlined />}
              onClick={() => {
                Modal.info({
                  title: 'kubectl 命令',
                  width: 600,
                  content: (
                    <div className="mt-4 space-y-3">
                      <Alert
                        message="使用以下命令配置 kubectl"
                        type="info"
                        showIcon
                      />
                      <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span># 登录到 Sirius 集群</span>
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() =>
                              handleCopyCommand(`tsh login --proxy=${currentCluster}:3080`)
                            }
                          />
                        </div>
                        <code>tsh login --proxy={currentCluster}:3080</code>

                        <div className="flex justify-between items-center mt-4 mb-2">
                          <span># 登录到 Kubernetes 集群</span>
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() =>
                              handleCopyCommand(`tsh kube login ${record.name}`)
                            }
                          />
                        </div>
                        <code>tsh kube login {record.name}</code>

                        <div className="flex justify-between items-center mt-4 mb-2">
                          <span># 使用 kubectl</span>
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() =>
                              handleCopyCommand(`kubectl get pods`)
                            }
                          />
                        </div>
                        <code>kubectl get pods</code>
                      </div>
                    </div>
                  ),
                });
              }}
            >
              kubectl
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title={
          <Space>
            <CloudOutlined />
            <span>Kubernetes 访问</span>
          </Space>
        }
      >
        <Alert
          message="安全访问 Kubernetes 集群"
          description="通过 Sirius 代理安全访问 Kubernetes 集群，所有 kubectl 操作都会被记录和审计。"
          type="info"
          showIcon
          className="mb-4"
        />

        <Space className="mb-4" wrap>
          <Input
            placeholder="搜索集群..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        {filteredClusters.length === 0 && !isLoading ? (
          <Empty
            description={
              searchText ? '未找到匹配的集群' : '暂无 Kubernetes 集群'
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredClusters}
            rowKey="name"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个集群`,
            }}
          />
        )}
      </Card>

      {/* 连接模态框 */}
      <Modal
        title={`连接到 ${selectedCluster?.name}`}
        open={connectModalVisible}
        onCancel={() => {
          setConnectModalVisible(false);
        }}
        footer={null}
        width={700}
      >
        <Tabs defaultActiveKey="kubeconfig">
          <TabPane tab="kubeconfig" key="kubeconfig">
            <Alert
              message="将以下内容保存为 ~/.kube/config"
              type="info"
              showIcon
              className="mb-3"
            />
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                {selectedCluster && generateKubeconfig(selectedCluster.name)}
              </pre>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                className="absolute top-2 right-2"
                onClick={() =>
                  selectedCluster &&
                  handleCopyCommand(generateKubeconfig(selectedCluster.name))
                }
              >
                复制
              </Button>
            </div>
          </TabPane>

          <TabPane tab="命令行" key="cli">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">1. 登录到 Sirius</h4>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">
                    tsh login --proxy={currentCluster}:3080
                  </code>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      handleCopyCommand(`tsh login --proxy=${currentCluster}:3080`)
                    }
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">2. 登录到 Kubernetes 集群</h4>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">
                    tsh kube login {selectedCluster?.name}
                  </code>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      handleCopyCommand(`tsh kube login ${selectedCluster?.name}`)
                    }
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">3. 使用 kubectl</h4>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">
                    kubectl get pods
                  </code>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyCommand('kubectl get pods')}
                  />
                </div>
              </div>
            </div>
          </TabPane>

          <TabPane tab="说明" key="help">
            <div className="space-y-3 text-sm">
              <p>
                <strong>前置条件：</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>已安装 tsh 命令行工具</li>
                <li>已安装 kubectl</li>
                <li>拥有访问该 Kubernetes 集群的权限</li>
              </ul>

              <p className="mt-4">
                <strong>功能特性：</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li>自动同步 Kubernetes 用户证书</li>
                <li>所有 kubectl 操作都会被审计记录</li>
                <li>支持多集群切换</li>
                <li>无需管理 kubeconfig 文件</li>
              </ul>

              <Alert
                message="安全提示"
                description="所有 kubectl 操作都会生成审计事件，可以在审计日志中查看。"
                type="warning"
                showIcon
                className="mt-4"
              />
            </div>
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  );
};
