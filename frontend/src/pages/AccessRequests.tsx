import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Badge,
  Empty,
  Alert,
  Typography,
  Tabs,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessRequestsApi, rolesApi } from '../api/client';
import type { AccessRequest } from '../types/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

export const AccessRequests = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [createForm] = Form.useForm();
  const [reviewForm] = Form.useForm();

  // 获取角色列表
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getRoles(),
  });

  const roles = Array.isArray(rolesData) ? rolesData : rolesData?.items || [];

  // 获取待处理请求
  const { data: pendingRequests = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['access-requests', 'pending'],
    queryFn: () => accessRequestsApi.getPendingAccessRequests(),
    enabled: activeTab === 'pending',
  });

  // 获取我的请求
  const { data: myRequests = [], isLoading: myLoading } = useQuery({
    queryKey: ['access-requests', 'my'],
    queryFn: () => accessRequestsApi.getMyAccessRequests(),
    enabled: activeTab === 'my',
  });

  // 获取所有请求
  const { data: allRequests = [], isLoading: allLoading } = useQuery({
    queryKey: ['access-requests', 'all'],
    queryFn: () => accessRequestsApi.getAccessRequests(),
    enabled: activeTab === 'all',
  });

  // 创建访问请求
  const createMutation = useMutation({
    mutationFn: (values: { roles: string[]; reason: string }) =>
      accessRequestsApi.createAccessRequest({
        roles: values.roles,
        reason: values.reason,
      }),
    onSuccess: () => {
      message.success('访问请求已创建');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      setIsCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '创建失败');
    },
  });

  // 审批访问请求
  const reviewMutation = useMutation({
    mutationFn: (values: { approved: boolean; reason?: string }) =>
      accessRequestsApi.reviewAccessRequest({
        request_id: selectedRequest!.id,
        approved: values.approved,
        reason: values.reason,
      }),
    onSuccess: () => {
      message.success('审批完成');
      queryClient.invalidateQueries({ queryKey: ['access-requests'] });
      setIsReviewModalOpen(false);
      setSelectedRequest(null);
      reviewForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error.message || '审批失败');
    },
  });

  const handleCreate = () => {
    createForm.resetFields();
    setIsCreateModalOpen(true);
  };

  const handleReview = (request: AccessRequest) => {
    setSelectedRequest(request);
    reviewForm.resetFields();
    setIsReviewModalOpen(true);
  };

  const handleViewDetail = (request: AccessRequest) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCreateSubmit = (values: { roles: string[]; reason: string }) => {
    createMutation.mutate(values);
  };

  const handleReviewSubmit = (values: { approved: boolean; reason?: string }) => {
    reviewMutation.mutate(values);
  };

  const getStatusBadge = (state: AccessRequest['state']) => {
    switch (state) {
      case 'pending':
        return <Badge status="warning" text="待审批" />;
      case 'approved':
        return <Badge status="success" text="已批准" />;
      case 'denied':
        return <Badge status="error" text="已拒绝" />;
      case 'expired':
        return <Badge status="default" text="已过期" />;
      default:
        return <Badge status="default" text="未知" />;
    }
  };

  const columns = [
    {
      title: '请求 ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <span className="font-mono text-sm">{id.slice(0, 8)}...</span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      render: (user: string) => (
        <Space>
          <UserOutlined />
          {user}
        </Space>
      ),
    },
    {
      title: '请求角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space size={[4, 4]} wrap>
          {roles.map((role) => (
            <Tag key={role} color="blue">{role}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      render: (state: AccessRequest['state']) => getStatusBadge(state),
    },
    {
      title: '创建时间',
      dataIndex: 'created',
      key: 'created',
      render: (time: string) => dayjs(time).format('MM-DD HH:mm'),
    },
    {
      title: '过期时间',
      dataIndex: 'expires',
      key: 'expires',
      render: (time: string) => (
        <Space>
          <ClockCircleOutlined />
          {dayjs(time).format('MM-DD HH:mm')}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: AccessRequest) => (
        <Space size="small">
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.state === 'pending' && activeTab === 'pending' && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                size="small"
                onClick={() => handleReview(record)}
              >
                审批
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                size="small"
                onClick={() => handleReview(record)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const renderTable = (data: AccessRequest[], loading: boolean) => (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 个请求`,
      }}
      locale={{
        emptyText: (
          <Empty
            description="暂无访问请求"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ),
      }}
    />
  );

  return (
    <div className="p-6">
      <Card
        title={<Title level={4}>访问请求</Title>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建请求
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          message="访问请求"
          description="当需要临时访问特定角色权限时，可以创建访问请求。请求需要管理员审批后才能生效。"
          className="mb-4"
        />

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="待审批" key="pending">
            {renderTable(pendingRequests, pendingLoading)}
          </TabPane>
          <TabPane tab="我的请求" key="my">
            {renderTable(myRequests, myLoading)}
          </TabPane>
          <TabPane tab="全部请求" key="all">
            {renderTable(allRequests, allLoading)}
          </TabPane>
        </Tabs>
      </Card>

      {/* 创建访问请求模态框 */}
      <Modal
        title="新建访问请求"
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateSubmit}
        >
          <Form.Item
            label="请求角色"
            name="roles"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择要请求的角色"
              options={roles.map((role: any) => ({
                label: role.name || role.metadata?.name,
                value: role.name || role.metadata?.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="请求原因"
            name="reason"
            rules={[{ required: true, message: '请输入请求原因' }]}
          >
            <TextArea
              rows={4}
              placeholder="请说明为什么需要这些角色的权限..."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending}
              >
                提交请求
              </Button>
              <Button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 审批模态框 */}
      <Modal
        title="审批访问请求"
        open={isReviewModalOpen}
        onCancel={() => {
          setIsReviewModalOpen(false);
          setSelectedRequest(null);
          reviewForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        {selectedRequest && (
          <Form
            form={reviewForm}
            layout="vertical"
            onFinish={handleReviewSubmit}
          >
            <Alert
              type="info"
              showIcon
              message={`用户 ${selectedRequest.user} 请求以下角色`}
              description={selectedRequest.roles.join(', ')}
              className="mb-4"
            />

            <Form.Item
              label="审批结果"
              name="approved"
              rules={[{ required: true, message: '请选择审批结果' }]}
            >
              <Select
                placeholder="选择审批结果"
                options={[
                  { label: '批准', value: true },
                  { label: '拒绝', value: false },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="审批意见"
              name="reason"
            >
              <TextArea
                rows={3}
                placeholder="可选：输入审批意见..."
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={reviewMutation.isPending}
                >
                  确认
                </Button>
                <Button
                  onClick={() => {
                    setIsReviewModalOpen(false);
                    setSelectedRequest(null);
                    reviewForm.resetFields();
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="访问请求详情"
        open={isDetailModalOpen}
        onCancel={() => {
          setIsDetailModalOpen(false);
          setSelectedRequest(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setIsDetailModalOpen(false);
              setSelectedRequest(null);
            }}
          >
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedRequest && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="请求 ID">
              {selectedRequest.id}
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {selectedRequest.user}
            </Descriptions.Item>
            <Descriptions.Item label="请求角色">
              <Space size={[4, 4]} wrap>
                {selectedRequest.roles.map((role) => (
                  <Tag key={role} color="blue">{role}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusBadge(selectedRequest.state)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedRequest.created).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="过期时间">
              {dayjs(selectedRequest.expires).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="请求原因">
              {selectedRequest.requestReason || '-'}
            </Descriptions.Item>
            {selectedRequest.resolveBy && (
              <>
                <Descriptions.Item label="审批人">
                  {selectedRequest.resolveBy}
                </Descriptions.Item>
                <Descriptions.Item label="审批时间">
                  {selectedRequest.resolveTime ?
                    dayjs(selectedRequest.resolveTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="审批意见">
                  {selectedRequest.resolveReason || '-'}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AccessRequests;
