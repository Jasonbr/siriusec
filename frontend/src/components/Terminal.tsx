import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Modal, Spin } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  clusterName: string;
  namespace?: string;
  serverId: string;
  login: string;
  serverHostname?: string;
  sessionId?: string; // 如果加入已有会话，传入会话 ID
  visible: boolean;
  onClose: () => void;
}

export const Terminal = ({
  clusterName,
  namespace = 'default',
  serverId,
  login,
  serverHostname,
  sessionId,
  visible,
  onClose,
}: TerminalProps) => {
  // 使用 window.__terminalRendered 来追踪组件是否被渲染
  if (typeof window !== 'undefined') {
    (window as any).__terminalRendered = true;
    (window as any).__terminalRenderCount = ((window as any).__terminalRenderCount || 0) + 1;
  }
  console.log('[Terminal] Component rendered, visible:', visible, 'serverId:', serverId);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { bearerToken } = useAuthStore();

  const connect = useCallback(() => {
    console.log('[Terminal] connect() called');
    console.log('[Terminal] terminalRef.current:', terminalRef.current ? 'exists' : 'null');
    console.log('[Terminal] bearerToken:', bearerToken ? bearerToken.substring(0, 20) + '...' : 'null');
    console.log('[Terminal] visible:', visible);
    
    if (!terminalRef.current || !bearerToken) {
      console.log('[Terminal] connect() early return - missing ref or token');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    // 构建终端参数
    // 如果有 sessionId，则加入已有会话；否则创建新会话
    const params = sessionId
      ? {
          server_id: '',
          login: '',
          term: { h: 40, w: 160 },
          sid: sessionId,
        }
      : {
          server_id: serverId,
          login: login,
          term: { h: 40, w: 160 },
          sid: '',
        };

    const encodedParams = encodeURIComponent(JSON.stringify(params));

    // 构建 WebSocket URL（使用当前页面的协议和主机，通过 Vite 代理转发）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/v1/webapi/sites/${clusterName}/namespaces/${namespace}/connect?access_token=${bearerToken}&params=${encodedParams}`;
    
    console.log('[Terminal] WebSocket URL:', wsUrl.substring(0, 100) + '...');

    try {
      // 创建 WebSocket 连接
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[Terminal] WebSocket opened');
      };

      // 创建 xterm 实例
      const xterm = new XTerm({
        cols: 160,
        rows: 40,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, Courier New, monospace',
        cursorBlink: true,
        cursorStyle: 'block',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
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
      xterm.loadAddon(new WebLinksAddon());

      // 打开终端
      console.log('[Terminal] Opening xterm...');
      xterm.open(terminalRef.current);
      fitAddon.fit();
      console.log('[Terminal] XTerm opened');

      // WebSocket 事件处理
      ws.onopen = () => {
        setIsConnecting(false);
        xterm.writeln('\r\n\x1b[32mConnected to server...\x1b[0m\r\n');
        console.log('[Terminal] WebSocket connected, terminal ready');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
          // 处理二进制数据
          event.data.arrayBuffer().then((buffer) => {
            const data = new Uint8Array(buffer);
            xterm.write(data);
          });
        } else {
          // 处理文本数据
          xterm.write(event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('[Terminal] WebSocket error:', error);
        setConnectionError('连接失败，请检查网络或服务器状态');
        setIsConnecting(false);
        xterm.writeln('\r\n\x1b[31mConnection error. Please try again.\x1b[0m\r\n');
      };

      ws.onclose = (event) => {
        console.log('[Terminal] WebSocket closed, code:', event.code);
        setIsConnecting(false);
        if (!event.wasClean) {
          xterm.writeln('\r\n\x1b[31mConnection closed unexpectedly.\x1b[0m\r\n');
        } else {
          xterm.writeln('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
        }
      };

      // 处理终端输入
      xterm.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // 处理终端大小变化
      xterm.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          const resizeData = JSON.stringify({
            event: 'resize',
            payload: { h: rows, w: cols },
          });
          ws.send(resizeData);
        }
      });

      // 窗口大小变化时自适应
      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener('resize', handleResize);

      // 清理函数
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('[Terminal] Failed to create terminal:', error);
      setConnectionError('创建终端失败');
      setIsConnecting(false);
    }
  }, [clusterName, namespace, serverId, login, sessionId, bearerToken, visible]);

  // 组件挂载时连接
  useEffect(() => {
    console.log('[Terminal] useEffect triggered, visible:', visible);
    if (visible) {
      // 延迟一点确保 DOM 已渲染
      const timer = setTimeout(() => {
        console.log('[Terminal] Calling connect() after timeout');
        const cleanup = connect();
        return () => {
          if (cleanup) cleanup();
          // 关闭 WebSocket
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          // 销毁终端
          if (xtermRef.current) {
            xtermRef.current.dispose();
            xtermRef.current = null;
          }
        };
      }, 100);
      
      return () => {
        clearTimeout(timer);
        // 关闭 WebSocket
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        // 销毁终端
        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }
      };
    }
  }, [visible, connect]);

  const handleReconnect = () => {
    // 关闭现有连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }
    // 重新连接
    connect();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <CodeOutlined />
          <span>
            {sessionId ? `加入会话 - ${sessionId.slice(0, 8)}...` : `SSH Terminal - ${serverHostname || serverId} (${login})`}
          </span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
      destroyOnClose
      styles={{
        body: { padding: 0, height: '600px' },
      }}
    >
      <div className="relative h-full bg-[#1e1e1e] rounded overflow-hidden">
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10">
            <Spin size="large" tip="正在连接..." />
          </div>
        )}

        {connectionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e] z-10">
            <div className="text-red-500 mb-4">{connectionError}</div>
            <button
              onClick={handleReconnect}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              重新连接
            </button>
          </div>
        )}

        <div
          ref={terminalRef}
          className="h-full w-full p-2"
          style={{ minHeight: '500px' }}
        />
      </div>
    </Modal>
  );
};
