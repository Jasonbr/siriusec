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
  ms: number;
  offset?: number;
  bytes?: number;
  ci?: number;
  size?: string;
}

interface PlaybackChunk {
  ms: number;
  data: Uint8Array;
}

interface ResizeEvent {
  ms: number;
  size: string;
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
  const [chunks, setChunks] = useState<PlaybackChunk[]>([]);
  const [resizeEvents, setResizeEvents] = useState<ResizeEvent[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAndPreparePlayback = useCallback(async () => {
    if (!visible) return;

    setIsLoading(true);
    try {
      const response = await auditApi.getSessionEvents(
        clusterName,
        namespace,
        sessionId
      );
      const data = response as { events: SessionEvent[] };
      const events = data.events || [];

      const printEvents = events.filter((e) => e.event === 'print');
      const resizes = events
        .filter((e) => e.event === 'resize' && e.size)
        .map((e) => ({ ms: e.ms, size: e.size! }));

      setResizeEvents(resizes);

      const preparedChunks: PlaybackChunk[] = [];

      for (const evt of printEvents) {
        if (evt.offset === undefined || evt.bytes === undefined || evt.bytes === 0) {
          continue;
        }

        try {
          const arrayBuffer = await auditApi.getSessionChunk(
            clusterName,
            namespace,
            sessionId,
            evt.offset,
            evt.bytes
          );

          let chunkData = new Uint8Array(arrayBuffer);

          if (arrayBuffer.byteLength > 2 && chunkData[0] === 0x1f && chunkData[1] === 0x8b) {
            try {
              const ds = new DecompressionStream('gzip');
              const stream = new Blob([arrayBuffer]).stream().pipeThrough(ds);
              const decompressed = await new Response(stream).arrayBuffer();
              chunkData = new Uint8Array(decompressed);
            } catch {
              // 如果解压失败，使用原始数据
            }
          }

          preparedChunks.push({ ms: evt.ms, data: chunkData });
        } catch (err) {
          console.warn(`Failed to fetch chunk at offset ${evt.offset}:`, err);
        }
      }

      preparedChunks.sort((a, b) => a.ms - b.ms);
      setChunks(preparedChunks);
      setCurrentChunkIndex(0);
    } catch (error) {
      console.error('Failed to load session events:', error);
      message.error('加载会话录屏失败');
    } finally {
      setIsLoading(false);
    }
  }, [clusterName, namespace, sessionId, visible]);

  useEffect(() => {
    if (!visible) return;

    // Delay to allow DOM ref to be populated after destroyOnClose
    const initTimer = setTimeout(() => {
      if (!terminalRef.current) return;

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

      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current);
      fitAddon.fit();

      loadAndPreparePlayback();

      const handleResize = () => fitAddon.fit();
      window.addEventListener('resize', handleResize);
    }, 100);

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', () => fitAddonRef.current?.fit());
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [visible, loadAndPreparePlayback]);

  const applyResizeAtMs = useCallback(
    (ms: number) => {
      if (!xtermRef.current) return;
      for (const re of resizeEvents) {
        if (re.ms <= ms) {
          const [cols, rows] = re.size.split(':').map(Number);
          if (cols && rows) {
            try {
              xtermRef.current.resize(cols, rows);
            } catch {
              // ignore resize errors
            }
          }
        }
      }
    },
    [resizeEvents]
  );

  const playChunks = useCallback(() => {
    if (!xtermRef.current || chunks.length === 0) return;

    setIsPlaying(true);

    const playNext = (index: number) => {
      if (index >= chunks.length) {
        setIsPlaying(false);
        setCurrentChunkIndex(chunks.length);
        return;
      }

      const chunk = chunks[index];
      const xterm = xtermRef.current;
      if (!xterm) return;

      applyResizeAtMs(chunk.ms);
      xterm.write(chunk.data);
      setCurrentChunkIndex(index + 1);

      if (index < chunks.length - 1) {
        const nextChunk = chunks[index + 1];
        const delay = (nextChunk.ms - chunk.ms) / playbackSpeed;
        playbackTimerRef.current = setTimeout(() => {
          playNext(index + 1);
        }, Math.max(delay, 10));
      } else {
        setIsPlaying(false);
      }
    };

    playNext(currentChunkIndex);
  }, [chunks, currentChunkIndex, playbackSpeed, applyResizeAtMs]);

  const pausePlayback = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlaying(false);
  };

  const resetPlayback = () => {
    pausePlayback();
    setCurrentChunkIndex(0);
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
    }
  };

  const seekTo = (index: number) => {
    pausePlayback();
    setCurrentChunkIndex(index);

    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();

      for (let i = 0; i < index && i < chunks.length; i++) {
        const chunk = chunks[i];
        applyResizeAtMs(chunk.ms);
        xtermRef.current.write(chunk.data);
      }
    }
  };

  const stepForward = () => {
    if (currentChunkIndex < chunks.length) {
      const chunk = chunks[currentChunkIndex];
      if (xtermRef.current) {
        applyResizeAtMs(chunk.ms);
        xtermRef.current.write(chunk.data);
      }
      setCurrentChunkIndex(currentChunkIndex + 1);
    }
  };

  const stepBackward = () => {
    if (currentChunkIndex > 0) {
      seekTo(currentChunkIndex - 1);
    }
  };

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
              disabled={currentChunkIndex === 0}
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
                onClick={playChunks}
                disabled={currentChunkIndex >= chunks.length}
              >
                播放
              </Button>
            )}
            <Button
              icon={<StepForwardOutlined />}
              onClick={stepForward}
              disabled={currentChunkIndex >= chunks.length}
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
            {currentChunkIndex} / {chunks.length} 事件
            {chunks.length > 0 && currentChunkIndex < chunks.length && (
              <span className="ml-2">
                ({formatTime(chunks[currentChunkIndex]?.ms || 0)})
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

        <div className="absolute bottom-0 left-0 right-0 bg-gray-800 p-2">
          <Slider
            min={0}
            max={chunks.length}
            value={currentChunkIndex}
            onChange={seekTo}
            tooltip={{
              formatter: (value) =>
                value !== undefined && value < chunks.length
                  ? formatTime(chunks[value]?.ms || 0)
                  : '',
            }}
          />
        </div>
      </div>
    </Modal>
  );
};
