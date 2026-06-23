import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Card,
  Badge,
  Modal,
  Descriptions,
  Timeline,
  Tooltip,
} from 'antd';
import {
  ClusterOutlined,
  DesktopOutlined,
  UserOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  VideoCameraOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { sessionsApi } from '../api/client';
import type { Session } from '../types/api';
import { SessionPlayer } from '../components/SessionPlayer';
import { Terminal } from '../components/Terminal';
import { useCluster } from '../hooks/useCluster';
import { Spin } from 'antd';

export const Sessions = () => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [joiningSession, setJoiningSession] = useState<Session | null>(null);
  const [joinTerminalVisible, setJoinTerminalVisible] = useState(false);
  const [joiningLoading, setJoiningLoading] = useState(false);
  const { clusterName } = useCluster();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions', clusterName],
    queryFn: async () => {
      const res = await sessionsApi.getSessions(clusterName);
      return res as { sessions: Session[] };
    },
  });

  const sessions = data?.sessions || [];

  const columns = [
    {
      title: '会话 ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Space>
          <ClusterOutlined />
          <span className="font-mono text-sm">{id.slice(0, 8)}...</span>
        </Space>
      ),
    },
    {
      title: '服务器',
      dataIndex: 'server_hostname',
      key: 'server_hostname',
      render: (text: string, record: Session) => (
        <Space>
          <DesktopOutlined />
          <span>{text || record.server_id}</span>
        </Space>
      ),
    },
    {
      title: '登录用户',
      dataIndex: 'login',
      key: 'login',
      render: (login: string) => (
        <Space>
          <UserOutlined />
          {login}
        </Space>
      ),
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns: string) => <Tag>{ns}</Tag>,
    },
    {
      title: '终端',
      key: 'terminal',
      render: (_: any, record: Session) => (
        <Tag icon={<CodeOutlined />}>
          {record.terminal_params?.w}x{record.terminal_params?.h}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created',
      key: 'created',
      render: (time: string) => dayjs(time).format('MM-DD HH:mm'),
    },
    {
      title: '最后活跃',
      dataIndex: 'last_active',
      key: 'last_active',
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
      render: (_: any, record: Session) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="small"
            onClick={() => handleJoinSession(record)}
            loading={joiningLoading && joiningSession?.id === record.id}
          >
            加入
          </Button>
          <Tooltip title="会话结束后才能回放，请在审计日志中查看">
            <Button
              type="default"
              icon={<VideoCameraOutlined />}
              size="small"
              disabled
            >
              回放
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleViewDetail = (session: Session) => {
    setSelectedSession(session);
    setDetailModalVisible(true);
  };

  const handleJoinSession = (session: Session) => {
    setJoiningSession(session);
    setJoinTerminalVisible(true);
  };

  const handlePlayRecording = (session: Session) => {
    setSelectedSession(session);
    setPlayerVisible(true);
  };

  const handleClosePlayer = () => {
    setPlayerVisible(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">会话管理</h1>
        <Button icon={<ClusterOutlined />} onClick={() => refetch()}>
          刷新
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <Badge status="processing" text={`活跃会话: ${sessions.length}`} />
        </div>

        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 个会话`,
          }}
          locale={{
            emptyText: '暂无活跃会话',
          }}
        />
      </Card>

      {/* 会话详情弹窗 */}
      <Modal
        title="会话详情"
        open={detailModalVisible}
        onOk={() => setDetailModalVisible(false)}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {selectedSession && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="会话 ID">
              <span className="font-mono">{selectedSession.id}</span>
            </Descriptions.Item>
            <Descriptions.Item label="服务器 ID">
              {selectedSession.server_id}
            </Descriptions.Item>
            <Descriptions.Item label="服务器主机名">
              {selectedSession.server_hostname || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="登录用户">
              {selectedSession.login}
            </Descriptions.Item>
            <Descriptions.Item label="命名空间">
              <Tag>{selectedSession.namespace}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="终端尺寸">
              {selectedSession.terminal_params?.w} x{' '}
              {selectedSession.terminal_params?.h}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedSession.created).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="最后活跃">
              {dayjs(selectedSession.last_active).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}

        {selectedSession?.parties && selectedSession.parties.length > 0 && (
          <div className="mt-6">
            <h4 className="font-bold mb-2">参与者</h4>
            <Timeline>
              {selectedSession.parties.map((party, index) => (
                <Timeline.Item key={index}>
                  <p>用户: {party.user}</p>
                  <p className="text-gray-500">地址: {party.server_addr}</p>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}
      </Modal>

      {/* 录屏播放器 */}
      {selectedSession && (
        <SessionPlayer
          clusterName={clusterName}
          namespace={selectedSession.namespace}
          sessionId={selectedSession.id}
          visible={playerVisible}
          onClose={handleClosePlayer}
        />
      )}

      {/* 加入会话加载 */}
      {joiningLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <Spin size="large" />
            <p className="mt-4 text-gray-600">正在加入会话...</p>
          </div>
        </div>
      )}

      {/* 加入会话终端 */}
      {joiningSession && (
        <Terminal
          clusterName={clusterName}
          serverId={joiningSession.server_id}
          login={joiningSession.login}
          sessionId={joiningSession.id}
          serverHostname={joiningSession.server_hostname}
          visible={joinTerminalVisible}
          onClose={() => {
            setJoinTerminalVisible(false);
            setJoiningSession(null);
          }}
        />
      )}
    </div>
  );
};
