import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Modal, Slider, Button, Space, message, Spin } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from '@ant-design/icons';
import { auditApi } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import '@xterm/xterm/css/xterm.css';

interface SessionPlayerProps {
  clusterName: string;
  namespace: string;
  sessionId: string;
  visible: boolean;
  onClose: () => void;
}

interface SessionEvent {
  event: string;
  data?: string;
  ms: number;
  offset?: number;
  bytes?: number;
  terminal_size?: string;
}

export const SessionPlayer = ({
  clusterName,
  namespace,
  sessionId,
  visible,
  onClose,
}: SessionPlayerProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载会话事件
  const loadEvents = useCallback(async () => {
    if (!visible) return;

    setIsLoading(true);
    try {
      const response = await auditApi.getSessionEvents(
        clusterName,
        namespace,
        sessionId
      );
      const data = response as { events: SessionEvent[] };

      // 过滤出打印事件
      const printEvents = data.events.filter(
        (e) => e.event === 'print' || e.event === 'resize'
      );

      setEvents(printEvents);
      setCurrentEventIndex(0);
    } catch (error) {
      console.error('Failed to load session events:', error);
      message.error('加载会话录屏失败');
    } finally {
      setIsLoading(false);
    }
  }, [clusterName, namespace, sessionId, visible]);

  // 初始化终端
  useEffect(() => {
    if (!visible || !terminalRef.current) return;

    // 创建 xterm 实例
    const xterm = new XTerm({
      cols: 160,
      rows: 40,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: false,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    });

    xtermRef.current = xterm;

    // 创建 fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    xterm.loadAddon(fitAddon);

    // 打开终端
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // 加载事件
    loadEvents();

    // 窗口大小变化时自适应
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [visible, loadEvents]);

  // 播放事件
  const playEvents = useCallback(() => {
    if (!xtermRef.current || events.length === 0) return;

    setIsPlaying(true);

    const playNextEvent = (index: number) => {
      if (index >= events.length) {
        setIsPlaying(false);
        setCurrentEventIndex(events.length);
        return;
      }

      const event = events[index];
      const xterm = xtermRef.current;

      if (!xterm) return;

      // 处理事件
      if (event.event === 'print' && event.data) {
        try {
          // Base64 解码
          const decoded = atob(event.data);
          xterm.write(decoded);
        } catch {
          // 如果不是 base64，直接写入
          xterm.write(event.data);
        }
      } else if (event.event === 'resize' && event.terminal_size) {
        const [cols, rows] = event.terminal_size.split(':').map(Number);
        if (cols && rows) {
          xterm.resize(cols, rows);
        }
      }

      setCurrentEventIndex(index + 1);

      // 计算下一个事件的延迟
      if (index < events.length - 1) {
        const nextEvent = events[index + 1];
        const delay = (nextEvent.ms - event.ms) / playbackSpeed;

        playbackTimerRef.current = setTimeout(() => {
          playNextEvent(index + 1);
        }, Math.max(delay, 10)); // 最小延迟 10ms
      } else {
        setIsPlaying(false);
      }
    };

    playNextEvent(currentEventIndex);
  }, [events, currentEventIndex, playbackSpeed]);

  // 暂停播放
  const pausePlayback = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
  };

  // 重置播放
  const resetPlayback = () => {
    pausePlayback();
    setCurrentEventIndex(0);
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
    }
  };

  // 跳转到指定位置
  const seekTo = (index: number) => {
    pausePlayback();
    setCurrentEventIndex(index);

    // 重新渲染到该位置
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();

      for (let i = 0; i < index && i < events.length; i++) {
        const event = events[i];
        if (event.event === 'print' && event.data) {
          try {
            const decoded = atob(event.data);
            xtermRef.current.write(decoded);
          } catch {
            xtermRef.current.write(event.data);
          }
        } else if (event.event === 'resize' && event.terminal_size) {
          const [cols, rows] = event.terminal_size.split(':').map(Number);
          if (cols && rows) {
            xtermRef.current.resize(cols, rows);
          }
        }
      }
    }
  };

  // 单步前进
  const stepForward = () => {
    if (currentEventIndex < events.length) {
      const event = events[currentEventIndex];
      if (xtermRef.current) {
        if (event.event === 'print' && event.data) {
          try {
            const decoded = atob(event.data);
            xtermRef.current.write(decoded);
          } catch {
            xtermRef.current.write(event.data);
          }
        } else if (event.event === 'resize' && event.terminal_size) {
          const [cols, rows] = event.terminal_size.split(':').map(Number);
          if (cols && rows) {
            xtermRef.current.resize(cols, rows);
          }
        }
      }
      setCurrentEventIndex(currentEventIndex + 1);
    }
  };

  // 单步后退
  const stepBackward = () => {
    if (currentEventIndex > 0) {
      seekTo(currentEventIndex - 1);
    }
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      title={`会话录屏 - ${sessionId}`}
      open={visible}
      onCancel={() => {
        pausePlayback();
        onClose();
      }}
      width={1200}
      footer={
        <div className="flex items-center justify-between">
          <Space>
            <Button
              icon={<StepBackwardOutlined />}
              onClick={stepBackward}
              disabled={currentEventIndex === 0}
            >
              后退
            </Button>
            {isPlaying ? (
              <Button
                type="primary"
                icon={<PauseCircleOutlined />}
                onClick={pausePlayback}
              >
                暂停
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={playEvents}
                disabled={currentEventIndex >= events.length}
              >
                播放
              </Button>
            )}
            <Button
              icon={<StepForwardOutlined />}
              onClick={stepForward}
              disabled={currentEventIndex >= events.length}
            >
              前进
            </Button>
            <Button icon={<ReloadOutlined />} onClick={resetPlayback}>
              重置
            </Button>
          </Space>

          <Space>
            <span>速度:</span>
            <Slider
              min={0.5}
              max={5}
              step={0.5}
              value={playbackSpeed}
              onChange={setPlaybackSpeed}
              style={{ width: 100 }}
            />
            <span>{playbackSpeed}x</span>
          </Space>

          <div className="text-gray-500">
            {currentEventIndex} / {events.length} 事件
            {events.length > 0 && currentEventIndex < events.length && (
              <span className="ml-2">
                ({formatTime(events[currentEventIndex]?.ms || 0)})
              </span>
            )}
          </div>
        </div>
      }
      destroyOnClose
      styles={{
        body: { padding: 0, height: '600px' },
      }}
    >
      <div className="relative h-full bg-[#1e1e1e] rounded overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10">
            <Spin size="large" tip="正在加载录屏数据..." />
          </div>
        )}

        <div
          ref={terminalRef}
          className="h-full w-full p-2"
          style={{ minHeight: '500px' }}
        />

        {/* 进度条 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-800 p-2">
          <Slider
            min={0}
            max={events.length}
            value={currentEventIndex}
            onChange={seekTo}
            tooltip={{
              formatter: (value) =>
                value !== undefined && value < events.length
                  ? formatTime(events[value]?.ms || 0)
                  : '',
            }}
          />
        </div>
      </div>
    </Modal>
  );
};
