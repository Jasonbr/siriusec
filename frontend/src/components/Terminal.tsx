import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Modal, Spin } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import '@xterm/xterm/css/xterm.css';

// ============================================================
// 轻量 Protobuf Envelope 编解码器
// 后端使用 gogo/protobuf 发送 Envelope{Version, Type, Payload}
// 字段定义: field1=Version(string), field2=Type(string), field3=Payload(string)
// Tag bytes: 0x0a=field1, 0x12=field2, 0x1a=field3 (wire type 2 = length-delimited)
// ============================================================

interface Envelope {
  version: string;
  type: string;
  payload: string;
}

// WebSocket 消息类型常量（与后端 defaults.go 保持一致）
const WS_TYPE_RAW = 'r';       // 原始终端数据
const WS_TYPE_RESIZE = 'w';    // 终端大小变更
const WS_TYPE_CLOSE = 'c';     // 会话关闭
const WS_TYPE_AUDIT = 'a';     // 审计事件
const WS_TYPE_U2F = 'u';       // U2F 挑战

function decodeVarint(data: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos];
    value |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [value, pos];
}

function decodeEnvelope(data: Uint8Array): Envelope {
  const env: Envelope = { version: '', type: '', payload: '' };
  let offset = 0;

  while (offset < data.length) {
    const tagByte = data[offset];
    offset++;
    const fieldNum = tagByte >> 3;
    const wireType = tagByte & 0x07;

    if (wireType !== 2) {
      // 跳过非 length-delimited 字段
      break;
    }

    const [length, newOffset] = decodeVarint(data, offset);
    offset = newOffset;
    const str = new TextDecoder('utf-8').decode(data.slice(offset, offset + length));
    offset += length;

    if (fieldNum === 1) env.version = str;
    else if (fieldNum === 2) env.type = str;
    else if (fieldNum === 3) env.payload = str;
  }

  return env;
}

function encodeEnvelope(type: string, payload: string): Uint8Array {
  const parts: Uint8Array[] = [];

  const encodeField = (tagByte: number, value: string) => {
    const bytes = new TextEncoder().encode(value);
    const header = new Uint8Array(2);
    header[0] = tagByte;
    let len = bytes.length;
    let i = 1;
    // 简单 varint 编码（payload 长度 < 128 时只需 1 字节）
    header[i++] = len & 0x7f;
    const field = new Uint8Array(i + bytes.length);
    field.set(header.slice(0, i), 0);
    field.set(bytes, i);
    return field;
  };

  if (type) parts.push(encodeField(0x12, type));
  if (payload) parts.push(encodeField(0x1a, payload));

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of parts) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

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
          server_id: serverId,
          login: login,
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
      ws.binaryType = 'arraybuffer';
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
        convertEol: true,
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
        const handleData = (raw: Uint8Array | string) => {
          // 如果是字符串，直接作为终端数据写入（后端发送纯文本模式）
          if (typeof raw === 'string') {
            console.log('[Terminal] Received text message:', raw.substring(0, 50));
            xterm.write(raw);
            return;
          }

          const bytes = raw;

          // 调试：打印原始数据的前 20 字节
          const hexBytes = Array.from(bytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          console.log('[Terminal] Raw bytes (first 20):', hexBytes, 'total length:', bytes.length);

          // 尝试检测是否为 protobuf 格式
          // Protobuf Envelope 以 0x0a (field1 tag) 开头
          // 如果不是 protobuf 格式，直接作为纯文本处理
          const isProtobuf = bytes.length > 2 && bytes[0] === 0x0a;
          
          if (!isProtobuf) {
            // 纯文本模式 - 直接写入终端
            const text = new TextDecoder('utf-8').decode(bytes);
            console.log('[Terminal] Plain text mode:', text.substring(0, 50));
            xterm.write(text);
            return;
          }

          // 解码 protobuf Envelope
          const envelope = decodeEnvelope(bytes);
          console.log('[Terminal] Envelope:', JSON.stringify(envelope));

          switch (envelope.type) {
            case WS_TYPE_RAW:
              // 原始终端数据，直接写入 xterm
              xterm.write(envelope.payload);
              break;
            case WS_TYPE_CLOSE:
              xterm.writeln('\r\n\x1b[33mSession closed.\x1b[0m\r\n');
              break;
            case WS_TYPE_AUDIT:
              // 审计事件，仅日志记录
              console.log('[Terminal] Audit event:', envelope.payload);
              break;
            case WS_TYPE_U2F:
              // U2F 挑战（当前未实现前端交互）
              console.log('[Terminal] U2F challenge:', envelope.payload);
              break;
            default:
              // 未知类型，尝试作为纯文本处理
              const text = new TextDecoder('utf-8').decode(bytes);
              console.warn('[Terminal] Unknown envelope type, treating as plain text:', envelope.type);
              xterm.write(text);
          }
        };

        if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buffer: ArrayBuffer) => {
            handleData(new Uint8Array(buffer));
          });
        } else if (event.data instanceof ArrayBuffer) {
          handleData(new Uint8Array(event.data as ArrayBuffer));
        } else {
          handleData(event.data as string);
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
          // 后端期望 protobuf Envelope{Type: "r", Payload: <输入数据>}
          const envelopeBytes = encodeEnvelope(WS_TYPE_RAW, data);
          // 复制到新的 ArrayBuffer 以避免 SharedArrayBuffer 类型问题
          const buffer = new Uint8Array(envelopeBytes).buffer;
          ws.send(buffer);
        }
      });

      // 处理终端大小变化
      xterm.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          // 后端期望 Payload = JSON {"size": "W:H"}
          const resizePayload = JSON.stringify({ size: `${cols}:${rows}` });
          const envelopeBytes = encodeEnvelope(WS_TYPE_RESIZE, resizePayload);
          const buffer = new Uint8Array(envelopeBytes).buffer;
          ws.send(buffer);
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
    if (!visible) return;

    let cleanupFn: (() => void) | undefined;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      cleanupFn = connect() as unknown as (() => void) | undefined;
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (cleanupFn) cleanupFn();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
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
