import { useState } from 'react';
import {
  Table,
  Card,
  DatePicker,
  Select,
  Input,
  Button,
  Space,
  Tag,
  Drawer,
  Descriptions,
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { auditApi } from '../api/client';
import { AuditEvent } from '../types/api';
import { useCluster } from '../hooks/useCluster';

const { RangePicker } = DatePicker;

// 事件代码映射
const EVENT_CODES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'T1000I': { label: '用户登录', color: 'green', icon: <LoginOutlined /> },
  'T1001I': { label: '用户登出', color: 'orange', icon: <LogoutOutlined /> },
  'T2000I': { label: '会话开始', color: 'blue', icon: <PlayCircleOutlined /> },
  'T2004I': { label: '会话结束', color: 'red', icon: <StopOutlined /> },
  'T3000I': { label: '执行命令', color: 'purple', icon: <FileTextOutlined /> },
  'T5000I': { label: '文件传输', color: 'cyan', icon: <FileTextOutlined /> },
};

export const Audit = () => {
  const { clusterName } = useCluster();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [eventType, setEventType] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const from = dateRange?.[0]?.toISOString();
  const to = dateRange?.[1]?.toISOString();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-events', clusterName, from, to, eventType],
    queryFn: async () => {
      const res = await auditApi.searchEvents(clusterName, {
        from,
        to,
        limit: 100,
        order: 'desc',
        include: eventType || undefined,
      });
      return res as { events: AuditEvent[]; startKey: string };
    },
  });

  const events = data?.events || [];

  const filteredEvents = events.filter((event) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      event.user?.toLowerCase().includes(searchLower) ||
      event.event?.toLowerCase().includes(searchLower) ||
      event.code?.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '事件',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string, record: AuditEvent) => {
        const eventInfo = EVENT_CODES[code] || {
          label: record.event,
          color: 'default',
          icon: <FileTextOutlined />,
        };
        return (
          <Tag color={eventInfo.color} icon={eventInfo.icon}>
            {eventInfo.label}
          </Tag>
        );
      },
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 120,
      render: (user: string) => user || '-',
    },
    {
      title: '集群',
      dataIndex: 'cluster_name',
      key: 'cluster_name',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 80,
      render: (success: boolean) =>
        success !== undefined ? (
          <Tag color={success ? 'success' : 'error'}>
            {success ? '成功' : '失败'}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: AuditEvent) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const handleViewDetail = (event: AuditEvent) => {
    setSelectedEvent(event);
    setDrawerVisible(true);
  };

  const eventTypeOptions = [
    { label: '全部事件', value: '' },
    { label: '用户登录', value: 'user.login' },
    { label: '会话开始', value: 'session.start' },
    { label: '会话结束', value: 'session.end' },
    { label: '执行命令', value: 'exec' },
    { label: '文件传输', value: 'scp' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">审计日志</h1>
      </div>

      <Card className="mb-6">
        <Space wrap>
          <RangePicker
            showTime
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始时间', '结束时间']}
          />
          <Select
            value={eventType}
            onChange={setEventType}
            options={eventTypeOptions}
            style={{ width: 150 }}
            placeholder="事件类型"
          />
          <Input
            placeholder="搜索用户或事件..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredEvents}
          rowKey="uid"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 事件详情抽屉 */}
      <Drawer
        title="事件详情"
        placement="right"
        width={600}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedEvent(null);
        }}
      >
        {selectedEvent && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="事件 ID">
              {selectedEvent.uid}
            </Descriptions.Item>
            <Descriptions.Item label="事件代码">
              <Tag color={EVENT_CODES[selectedEvent.code]?.color || 'default'}>
                {selectedEvent.code}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="事件类型">
              {selectedEvent.event}
            </Descriptions.Item>
            <Descriptions.Item label="时间">
              {dayjs(selectedEvent.time).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="集群">
              {selectedEvent.cluster_name}
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {selectedEvent.user || '-'}
            </Descriptions.Item>
            {selectedEvent.method && (
              <Descriptions.Item label="方法">
                {selectedEvent.method}
              </Descriptions.Item>
            )}
            {selectedEvent.success !== undefined && (
              <Descriptions.Item label="状态">
                <Tag color={selectedEvent.success ? 'success' : 'error'}>
                  {selectedEvent.success ? '成功' : '失败'}
                </Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}

        {selectedEvent && Object.keys(selectedEvent).length > 10 && (
          <div className="mt-6">
            <h4 className="font-bold mb-2">完整数据</h4>
            <pre
              className="bg-gray-100 p-4 rounded overflow-auto"
              style={{ maxHeight: '40vh' }}
            >
              <code>{JSON.stringify(selectedEvent, null, 2)}</code>
            </pre>
          </div>
        )}
      </Drawer>
    </div>
  );
};
