# Siriusec v7 前端开发分析报告

> 基于实际 API 调用测试，为独立前端开发提供参考。

---

## 一、平台现状概览

### 1.1 集群信息

| 属性 | 值 |
|------|-----|
| 集群名称 | `localhost` |
| 版本 | `7.3.9` |
| 状态 | `online` |
| 节点数 | 1（代理节点自身）|
| 命名空间 | `default` |

### 1.2 用户权限分析

当前用户 `admin` 拥有角色：`editor`, `access`, `auditor`

**ACL 权限矩阵：**

| 资源 | List | Read | Edit | Create | Delete |
|------|------|------|------|--------|--------|
| 用户 (users) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 角色 (roles) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 认证连接器 (authConnectors) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 可信集群 (trustedClusters) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 令牌 (tokens) | ✅ | ✅ | ✅ | ✅ | ✅ |
| 审计事件 (events) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 节点 (nodes) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 应用服务器 (appServers) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 数据库服务器 (dbServers) | ✅ | ✅ | ❌ | ❌ | ❌ |
| K8s 服务器 (kubeServers) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 会话 (sessions) | ✅ | ✅ | ❌ | ❌ | ❌ |
| 访问请求 (accessRequests) | ❌ | ❌ | ❌ | ❌ | ❌ |

**SSH 登录权限：** `root`, `admin`

---

## 二、数据模型分析

### 2.1 集群 (Cluster)

```typescript
interface Cluster {
  name: string;           // "localhost"
  lastConnected: string;  // ISO 8601 时间
  status: "online" | "offline";
  nodeCount: number;
  publicURL: string;      // 代理地址
  authVersion: string;    // Auth 服务版本
  proxyVersion: string;   // Proxy 服务版本
}
```

### 2.2 节点 (Node)

```typescript
interface Node {
  id: string;             // UUID
  siteId: string;         // 集群名称
  hostname: string;       // 主机名
  addr: string;           // IP:Port
  tunnel: boolean;        // 是否通过反向隧道
  tags: Label[];          // 标签列表
}

interface Label {
  name: string;
  value: string;
}
```

### 2.3 用户 (User)

```typescript
interface User {
  name: string;           // 用户名
  roles: string[];        // 角色列表
  authType: "local" | "oidc" | "saml" | "github";
}
```

### 2.4 角色 (Role)

```typescript
interface Role {
  id: string;             // "role:{name}"
  kind: "role";
  name: string;
  content: string;        // YAML 格式完整定义
}
```

### 2.5 审计事件 (AuditEvent)

```typescript
interface AuditEvent {
  cluster_name: string;
  code: string;           // 事件代码如 "T1000I"
  ei: number;             // 事件索引
  event: string;          // 事件类型如 "user.login"
  time: string;           // ISO 8601
  uid: string;            // 事件唯一 ID
  // 事件特定字段
  user?: string;
  method?: string;
  success?: boolean;
}
```

**常见事件类型：**

| 代码 | 事件 | 说明 |
|------|------|------|
| T1000I | user.login | 用户登录 |
| T2000I | session.start | SSH 会话开始 |
| T2004I | session.end | SSH 会话结束 |
| T3000I | exec | 执行命令 |
| T5000I | scp | 文件传输 |

### 2.6 命名空间 (Namespace)

```typescript
interface Namespace {
  kind: "namespace";
  version: "v2";
  metadata: {
    name: string;
    id: number;
  };
  spec: {};
}
```

### 2.7 用户上下文 (UserContext)

```typescript
interface UserContext {
  authType: "local" | "sso";
  userName: string;
  userAcl: ACL;
  cluster: Cluster;
  accessStrategy: {
    type: "optional" | "reason" | "always";
    prompt: string;
  };
  accessCapabilities: {
    requestableRoles: string[] | null;
    suggestedReviewers: string[] | null;
  };
}

interface ACL {
  [resource: string]: {
    list: boolean;
    read: boolean;
    edit: boolean;
    create: boolean;
    delete: boolean;  // API 返回为 "remove"
  };
}
```

---

## 三、认证机制详解

### 3.1 登录流程

```
1. GET /web/login
   → 响应头 Set-Cookie: grv_csrf=<csrf_token>
   → 保存 CSRF Token

2. POST /v1/webapi/sessions/web
   Headers:
     - Content-Type: application/json
     - X-CSRF-Token: <csrf_token>
     - Cookie: grv_csrf=<csrf_token>
   Body: {"user": "admin", "pass": "password", "second_factor_token": ""}
   
   → 响应 Set-Cookie: grv_session=<user>;<session_id>
   → 响应体: {"type": "Bearer", "token": "bearer_token", ...}
```

### 3.2 后续请求认证

所有需要认证的 API 必须同时携带：

```
Headers:
  Authorization: Bearer <bearer_token>
  X-CSRF-Token: <csrf_token>
  
Cookies:
  grv_csrf=<csrf_token>
  grv_session=<user>;<session_id>
```

> ⚠️ **重要**：v7 后端会同时校验 Bearer Token 和 Session Cookie，缺一不可。

---

## 四、前端页面结构建议

基于 API 能力和权限分析，建议实现以下页面：

### 4.1 认证模块

| 页面 | 路径 | 说明 |
|------|------|------|
| 登录 | `/login` | 用户名密码登录 |
| 邀请设置密码 | `/invite/:token` | 新用户首次设置密码 |
| 重置密码 | `/reset/:token` | 忘记密码重置 |

### 4.2 仪表板模块

| 页面 | 路径 | 所需权限 |
|------|------|---------|
| 概览 | `/` | 任意登录用户 |
| 集群列表 | `/clusters` | nodes:list |
| 集群详情 | `/clusters/:name` | nodes:list |

### 4.3 资源管理模块

| 页面 | 路径 | 所需权限 |
|------|------|---------|
| 节点列表 | `/nodes` | nodes:list |
| SSH 终端 | `/nodes/:id/ssh` | nodes:read + SSH 登录权限 |
| 应用列表 | `/apps` | appServers:list |
| 数据库列表 | `/databases` | dbServers:list |
| K8s 集群 | `/kubernetes` | kubeServers:list |

### 4.4 会话管理模块

| 页面 | 路径 | 所需权限 |
|------|------|---------|
| 活跃会话 | `/sessions/active` | sessions:list |
| 录屏回放 | `/sessions/:id/replay` | sessions:read |
| 审计日志 | `/audit/events` | events:list |

### 4.5 访问控制模块

| 页面 | 路径 | 所需权限 |
|------|------|---------|
| 用户管理 | `/access/users` | users:list |
| 角色管理 | `/access/roles` | roles:list |
| 认证连接器 | `/access/auth-connectors` | authConnectors:list |
| 可信集群 | `/access/trusted-clusters` | trustedClusters:list |

---

## 五、技术栈建议

### 5.1 推荐方案

| 类别 | 推荐技术 | 说明 |
|------|---------|------|
| 框架 | React 18 + TypeScript | 类型安全，生态成熟 |
| 构建 | Vite | 快速开发体验 |
| UI 组件 | Ant Design 5.x | 企业级组件库 |
| 状态管理 | Zustand | 轻量，无样板代码 |
| 数据获取 | TanStack Query (React Query) | 缓存、重试、乐观更新 |
| 路由 | React Router v6 | 标准路由方案 |
| WebSocket | xterm.js + socket.io | 终端仿真 |
| 图表 | ECharts / AntV | 审计数据可视化 |
| 样式 | Tailwind CSS | 原子化样式 |

### 5.2 项目结构

```
frontend/
├── src/
│   ├── api/              # API 客户端
│   │   ├── client.ts     # axios 实例
│   │   ├── auth.ts       # 认证相关 API
│   │   ├── clusters.ts   # 集群 API
│   │   ├── nodes.ts      # 节点 API
│   │   ├── users.ts      # 用户 API
│   │   ├── roles.ts      # 角色 API
│   │   ├── sessions.ts   # 会话 API
│   │   └── audit.ts      # 审计 API
│   ├── components/       # 公共组件
│   │   ├── Layout/
│   │   ├── Terminal/
│   │   ├── NodeTable/
│   │   └── SessionPlayer/
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   ├── useNodes.ts
│   │   └── useSessions.ts
│   ├── pages/            # 页面组件
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── Nodes/
│   │   ├── Sessions/
│   │   ├── Users/
│   │   └── Audit/
│   ├── stores/           # 状态管理
│   │   └── authStore.ts
│   ├── types/            # TypeScript 类型
│   │   ├── api.ts        # API 响应类型
│   │   └── models.ts     # 业务模型
│   ├── utils/            # 工具函数
│   │   ├── auth.ts       # Token 处理
│   │   └── format.ts     # 数据格式化
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 六、关键实现细节

### 6.1 API 客户端封装

```typescript
// api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/v1',
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截器：自动添加认证头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bearer_token');
  const csrf = localStorage.getItem('csrf_token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  
  // Cookie 由浏览器自动携带
  return config;
});

// 响应拦截器：处理 401 过期
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### 6.2 登录逻辑

```typescript
// hooks/useAuth.ts
import { useMutation } from '@tanstack/react-query';

const login = async (credentials: LoginCredentials) => {
  // 1. 先获取 CSRF Token
  const csrfRes = await fetch('/web/login', { credentials: 'include' });
  const csrfMatch = csrfRes.headers.get('set-cookie')?.match(/grv_csrf=([^;]+)/);
  const csrf = csrfMatch?.[1];
  
  // 2. 登录请求
  const res = await fetch('/v1/webapi/sessions/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf!,
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  
  const data = await res.json();
  
  // 3. 保存 Token
  localStorage.setItem('bearer_token', data.token);
  localStorage.setItem('csrf_token', csrf!);
  
  return data;
};

export const useLogin = () => useMutation({ mutationFn: login });
```

### 6.3 WebSocket 终端

```typescript
// components/Terminal/Terminal.tsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const SSHTerminal = ({ cluster, serverId, login }: Props) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    const term = new Terminal({
      cols: 160,
      rows: 40,
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // 构建 WebSocket URL
    const params = encodeURIComponent(JSON.stringify({
      server_id: serverId,
      login: login,
      term: { h: 40, w: 160 },
      sid: '',
    }));
    
    const token = localStorage.getItem('bearer_token');
    const ws = new WebSocket(
      `wss://localhost:3080/v1/webapi/sites/${cluster}/namespaces/default/connect?` +
      `access_token=${token}&params=${params}`
    );
    
    ws.onopen = () => {
      term.writeln('Connected to server...');
    };
    
    ws.onmessage = (e) => {
      // 处理二进制/文本数据
      if (e.data instanceof Blob) {
        e.data.text().then((text) => term.write(text));
      } else {
        term.write(e.data);
      }
    };
    
    // 输入转发
    term.onData((data) => {
      ws.send(data);
    });
    
    wsRef.current = ws;
    
    return () => {
      ws.close();
      term.dispose();
    };
  }, [cluster, serverId, login]);
  
  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
};
```

### 6.4 权限控制组件

```typescript
// components/Auth/PermissionGuard.tsx
import { useUserContext } from '@/hooks/useUserContext';

interface Props {
  resource: string;
  action: 'list' | 'read' | 'edit' | 'create' | 'delete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard = ({ resource, action, children, fallback }: Props) => {
  const { userContext } = useUserContext();
  const acl = userContext?.userAcl?.[resource];
  
  const hasPermission = acl?.[action] ?? false;
  
  return hasPermission ? <>{children}</> : (fallback ?? null);
};

// 使用示例
<PermissionGuard resource="users" action="create">
  <Button>创建用户</Button>
</PermissionGuard>
```

---

## 七、与 v13 前端的差异

| 特性 | v7 (当前) | v13+ |
|------|----------|------|
| 认证方式 | Cookie + Bearer | 相同 |
| API 前缀 | `/v1` | `/v1` |
| WebSocket 终端 | 原生 WebSocket | 相同 |
| 录屏回放 | 原始流 | 相同 |
| 访问请求 | 不支持 (accessRequests ACL 全 false) | 支持 |
| 设备信任 | 不支持 | 支持 |
| 会话锁定 | 不支持 | 支持 |

**结论：** v7 前端可以完整实现核心功能（SSH 终端、审计回放、用户/角色管理），但不需要实现访问请求、设备信任等高级功能。

---

## 八、开发优先级建议

### Phase 1: MVP（2-3 周）

1. ✅ 登录/登出
2. ✅ 集群概览
3. ✅ 节点列表
4. ✅ SSH 终端（WebSocket）

### Phase 2: 核心功能（2-3 周）

5. ✅ 活跃会话列表
6. ✅ 审计事件列表
7. ✅ 录屏回放播放器

### Phase 3: 管理功能（2-3 周）

8. ✅ 用户管理（CRUD）
9. ✅ 角色管理（CRUD）
10. ✅ 认证连接器管理

### Phase 4: 增强（可选）

11. 文件传输（SCP）
12. 应用访问代理
13. 数据库访问代理

---

## 九、测试数据

当前环境可用于测试的数据：

- **用户**: `admin` / `Xiaoxi@0109`
- **集群**: `localhost`
- **命名空间**: `default`
- **节点**: 空（需要注册节点才能测试 SSH）
- **角色**: `access`, `auditor`, `editor`, `admin`
- **审计事件**: 有历史登录记录

---

## 十、参考资源

- API 文档: `docs/api-v7.md`
- 后端源码: `lib/web/apiserver.go`
- UI 类型定义: `lib/web/ui/*.go`
