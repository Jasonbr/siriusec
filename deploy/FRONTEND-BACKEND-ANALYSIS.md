# Siriusec 前后端功能对比分析报告

> 生成时间: 2026-05-26
> 分析范围: 后端 API (lib/web/apiserver.go, lib/auth/grpcserver.go) vs 前端代码 (frontend/)

---

## 1. 项目架构概览

### 1.1 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Go 1.16, httprouter, gRPC, Protobuf |
| **前端** | React 19, TypeScript, Vite, Ant Design 6, xterm.js |
| **状态管理** | Zustand + persist, TanStack React Query |
| **认证** | 本地认证, OIDC, SAML, GitHub OAuth, U2F/2FA |

### 1.2 代码结构

```
siriusec/
├── tool/siriusec/           # 服务入口
├── lib/
│   ├── web/                 # Web API 服务器 (apiserver.go - 81KB)
│   ├── auth/                # 认证服务 (grpcserver.go - 91KB)
│   ├── service/             # 服务编排 (service.go - 118KB)
│   ├── srv/                 # SSH/DB/App 服务实现
│   └── config/              # 配置管理
├── api/client/proto/        # Protobuf 定义 (112 个 gRPC 方法)
└── frontend/                # 前端源码 (React + TypeScript)
```

---

## 2. 后端 API 完整清单

### 2.1 Web API 端点 (lib/web/apiserver.go)

#### 公开端点 (无需认证)

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/webapi/ping` | 健康检查 |
| GET | `/webapi/ping/:connector` | 连接器健康检查 |
| GET | `/webapi/find` | 资源搜索 |
| GET | `/.well-known/jwks.json` | JWT 公钥 |
| GET | `/webapi/motd` | 当日消息 |
| POST | `/webapi/sessions/web` | 创建 Web 会话 (登录) |
| POST | `/webapi/trustedclusters/validate` | 验证可信集群 |
| POST | `/webapi/ssh/certs` | 生成 SSH 证书 |
| POST | `/webapi/u2f/signrequest` | MFA 挑战 |
| POST | `/webapi/u2f/sessions` | U2F 登录 |
| POST | `/webapi/u2f/certs` | U2F 证书 |
| GET | `/webapi/u2f/signuptokens/:token` | U2F 注册 |
| GET | `/webapi/users/password/token/:token` | 获取重置密码 Token |
| PUT | `/webapi/users/password/token` | 使用 Token 修改密码 |
| POST | `/webapi/host/credentials` | 主机凭证 |

#### SSO 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/webapi/oidc/login/web` | OIDC Web 登录 |
| GET | `/webapi/oidc/callback` | OIDC 回调 |
| POST | `/webapi/oidc/login/console` | OIDC 控制台登录 |
| GET | `/webapi/saml/sso` | SAML SSO |
| POST | `/webapi/saml/acs` | SAML ACS |
| POST | `/webapi/saml/login/console` | SAML 控制台登录 |
| GET | `/webapi/github/login/web` | GitHub Web 登录 |
| GET | `/webapi/github/callback` | GitHub 回调 |
| POST | `/webapi/github/login/console` | GitHub 控制台登录 |

#### 认证端点 (需要登录)

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/webapi/sessions/app` | 创建应用会话 |
| DELETE | `/webapi/sessions` | 删除会话 (登出) |
| POST | `/webapi/sessions/renew` | 续期会话 |
| GET | `/webapi/user/status` | 用户状态 |
| GET | `/webapi/users` | 用户列表 |
| POST | `/webapi/users` | 创建用户 |
| PUT | `/webapi/users` | 更新用户 |
| DELETE | `/webapi/users/:username` | 删除用户 |
| PUT | `/webapi/users/password` | 修改密码 |
| POST | `/webapi/users/password/token` | 创建重置 Token |
| GET | `/webapi/sites` | 集群列表 |
| GET | `/webapi/sites/:site/namespaces` | 命名空间列表 |
| GET | `/webapi/sites/:site/namespaces/:namespace/nodes` | 节点列表 |
| GET | `/webapi/sites/:site/namespaces/:namespace/connect` | WebSocket 终端 |
| GET | `/webapi/sites/:site/namespaces/:namespace/sessions` | 活跃会话列表 |
| POST | `/webapi/sites/:site/namespaces/:namespace/sessions` | 创建会话 |
| GET | `/webapi/sites/:site/namespaces/:namespace/sessions/:sid` | 会话详情 |
| GET | `/webapi/sites/:site/namespaces/:namespace/sessions/:sid/events` | 会话事件 |
| GET | `/webapi/sites/:site/namespaces/:namespace/sessions/:sid/stream` | 会话字节流 |
| GET | `/webapi/sites/:site/events/search` | 审计事件搜索 |
| GET/POST | `/webapi/sites/:site/namespaces/:namespace/nodes/:server/:login/scp` | SCP 文件传输 |
| GET | `/webapi/sites/:site/context` | 用户上下文 |
| GET | `/webapi/sites/:site/apps` | 应用列表 |
| GET | `/webapi/sites/:site/databases` | 数据库列表 |
| GET | `/webapi/sites/:site/kubernetes` | K8s 集群列表 |
| GET | `/webapi/roles` | 角色列表 |
| PUT/POST | `/webapi/roles` | 创建/更新角色 |
| DELETE | `/webapi/roles/:name` | 删除角色 |
| GET | `/webapi/github` | GitHub 连接器列表 |
| PUT/POST | `/webapi/github` | 创建/更新 GitHub 连接器 |
| DELETE | `/webapi/github/:name` | 删除 GitHub 连接器 |
| GET | `/webapi/trustedcluster` | 可信集群列表 |
| PUT/POST | `/webapi/trustedcluster` | 创建/更新可信集群 |
| DELETE | `/webapi/trustedcluster/:name` | 删除可信集群 |

### 2.2 gRPC API (lib/auth/grpcserver.go)

共 **112 个 gRPC 方法**，包括:

- 节点管理: GetNode, GetNodes, ListNodes, UpsertNode, DeleteNode
- 证书生成: GenerateUserCerts, GenerateDatabaseCert
- 用户管理: GetUser, GetUsers, CreateUser, UpdateUser, DeleteUser
- 角色管理: GetRole, GetRoles, UpsertRole, DeleteRole
- 会话管理: GetWebSession, CreateAppSession, DeleteWebSession
- MFA 设备: AddMFADevice, GetMFADevices, DeleteMFADevice
- SSO 连接器: OIDC/SAML/GitHub CRUD
- 可信集群: CRUD 操作
- 审计事件: EmitAuditEvent, CreateAuditStream
- 访问请求: GetAccessRequests, CreateAccessRequest

---

## 3. 前端功能清单

### 3.1 页面 (10 个)

| 页面 | 路由 | 功能 |
|------|------|------|
| Login | `/login` | 用户名/密码登录 |
| Dashboard | `/` | 系统概览 (集群/会话/用户/节点/权限) |
| Nodes | `/nodes` | SSH 节点列表 + SSH 终端 + 文件传输 |
| Sessions | `/sessions` | 活跃会话列表 + 录屏回放 |
| Users | `/users` | 用户 CRUD |
| Roles | `/roles` | 角色 CRUD + YAML 编辑 |
| Audit | `/audit` | 审计日志搜索 + 事件详情 |
| Apps | `/apps` | 应用服务器列表 |
| Databases | `/databases` | 数据库服务器列表 |
| Kubernetes | `/kubernetes` | K8s 集群列表 + kubeconfig 指引 |

### 3.2 组件 (5 个)

| 组件 | 功能 |
|------|------|
| Layout | 主布局 + 侧边栏 + 集群选择器 + 用户菜单 |
| Terminal | SSH WebSocket 终端 (xterm.js) |
| SessionPlayer | 会话录屏播放器 (播放/暂停/调速/进度条) |
| FileTransfer | SCP 文件上传/下载 |
| PermissionGuard | 权限守卫 + usePermission Hook |

### 3.3 已调用的 API (22 个端点)

| API 组 | 端点 | 使用页面 |
|--------|------|---------|
| authApi | POST `/webapi/sessions/web` | Login |
| authApi | DELETE `/webapi/sessions` | Logout |
| authApi | GET `/webapi/sites/:cluster/context` | Dashboard, Layout |
| clustersApi | GET `/webapi/sites` | Dashboard, Apps, Databases, Kubernetes |
| nodesApi | GET `/webapi/sites/:site/namespaces/:ns/nodes` | Nodes |
| usersApi | GET/POST/PUT/DELETE `/webapi/users` | Users |
| rolesApi | GET/POST/DELETE `/webapi/roles` | Roles |
| sessionsApi | GET `/webapi/sites/:site/namespaces/:ns/sessions` | Sessions |
| sessionsApi | GET `/webapi/sites/:site/namespaces/:ns/sessions/:sid` | Sessions |
| auditApi | GET `/webapi/sites/:site/events/search` | Audit |
| auditApi | GET `/webapi/sites/:site/namespaces/:ns/sessions/:sid/events` | SessionPlayer |
| scpApi | GET/POST `/webapi/sites/:site/namespaces/:ns/nodes/:server/:login/scp` | FileTransfer |
| appsApi | GET `/webapi/sites/:site/apps` | Apps |
| appsApi | POST `/webapi/sessions/app` | Apps |
| databasesApi | GET `/webapi/sites/:site/databases` | Databases |
| kubernetesApi | GET `/webapi/sites/:site/kubernetes` | Kubernetes |
| WebSocket | `/webapi/sites/:site/namespaces/:ns/connect` | Terminal |

---

## 4. 功能对比分析

### 4.1 已完成功能 (前端已实现)

| 功能模块 | 完成度 | 说明 |
|---------|--------|------|
| **用户认证** | 50% | 本地用户名/密码登录已完成，SSO 未实现 |
| **节点管理** | 90% | 节点列表、SSH 终端、文件传输已完成 |
| **会话管理** | 75% | 会话列表、录屏回放已完成，创建/加入会话未完成 |
| **用户管理** | 70% | 用户 CRUD 已完成，密码修改未完成 |
| **角色管理** | 90% | 角色 CRUD + YAML 编辑已完成 |
| **审计日志** | 90% | 日志搜索、事件详情已完成 |
| **应用访问** | 60% | 应用列表已完成，连接功能需 CLI 配合 |
| **数据库访问** | 60% | 数据库列表已完成，连接功能需 CLI 配合 |
| **Kubernetes** | 60% | 集群列表 + 指引已完成，连接功能需 CLI 配合 |

### 4.2 未完成功能 (高优先级)

| 功能 | 涉及 API | 缺失页面/组件 | 影响 |
|------|---------|--------------|------|
| **密码修改** | `PUT /webapi/users/password` | 用户设置页面 | 用户无法修改自己的密码 |
| **创建新会话** | `POST /webapi/sites/:site/namespaces/:ns/sessions` | Nodes 页面缺少"连接"按钮 | 只能查看已有会话，不能主动连接节点 |
| **加入活跃会话** | WebSocket connect | Sessions 页面"加入"按钮标记为 TODO | 用户无法协作排查问题 |
| **SSO 登录** | OIDC/SAML/GitHub 端点 | Login 页面缺少 SSO 选项 | 无法使用企业身份认证 |
| **2FA/MFA 支持** | U2F/MFA 端点 | Login 页面缺少 TOTP 输入 | 无法使用双因素认证 |

### 4.3 未完成功能 (中优先级)

| 功能 | 涉及 API | 缺失页面/组件 | 影响 |
|------|---------|--------------|------|
| **密码重置** | `/webapi/users/password/token` | "忘记密码"流程 | 用户忘记密码无法自助重置 |
| **会话字节流** | `/webapi/sites/:site/namespaces/:ns/sessions/:sid/stream` | SessionPlayer | 录屏播放器仅使用 events，未使用 stream API |
| **可信集群管理** | `/webapi/trustedcluster` | 可信集群管理页面 | 无法可视化管理多集群 |
| **GitHub 连接器管理** | `/webapi/github` | GitHub 连接器管理页面 | 无法可视化管理 GitHub SSO |
| **续期会话** | `POST /webapi/sessions/renew` | 自动续期逻辑 | 会话过期后需重新登录 |

### 4.4 未完成功能 (低优先级)

| 功能 | 涉及 API | 缺失页面/组件 |
|------|---------|--------------|
| 访问请求管理 | Access Request API | 访问请求页面 |
| 令牌管理 | `/v1/tokens` | 令牌管理页面 |
| 消息推送/MOTD | `/webapi/motd` | 消息展示 |
| 认证连接器管理 | OIDC/SAML 端点 | 连接器管理页面 |
| 健康检查 | `/webapi/ping` | 系统健康页面 |

---

## 5. 代码质量问题

### 5.1 前端问题

| 问题 | 位置 | 说明 |
|------|------|------|
| 命名空间未使用 | clustersApi.getNamespaces | 代码已实现但页面未调用 |
| 会话创建缺失 | Nodes.tsx | 终端组件只连接已有会话，没有创建新会话能力 |
| 加入会话 TODO | Sessions.tsx | "加入"按钮功能标记为 TODO |
| 缺少用户设置页 | - | 无密码修改功能 |
| SSO 完全缺失 | Login.tsx | 无 OIDC/SAML/GitHub 登录选项 |

### 5.2 后端问题

| 问题 | 位置 | 说明 |
|------|------|------|
| 品牌替换不完整 | 全项目 | 部分代码仍使用 "teleport" 而非 "siriusec" |
| gRPC 未使用 | apiserver.go | gRPC 已实现但前端未调用 (使用的是 HTTP API) |

---

## 6. 开发建议

### 6.1 高优先级任务

1. **添加密码修改功能**
   - 创建用户设置页面
   - 调用 `PUT /webapi/users/password`
   - 需要旧密码验证

2. **实现创建新会话**
   - 在 Nodes 页面添加"连接"按钮
   - 调用 `POST /webapi/sites/:site/namespaces/:ns/sessions`
   - 打开 Terminal 组件

3. **实现加入活跃会话**
   - 完成 Sessions 页面的"加入"按钮
   - 使用 WebSocket connect 端点
   - 共享已有会话

4. **添加 SSO 登录支持**
   - 在 Login 页面添加 OIDC/SAML/GitHub 选项
   - 实现 SSO 重定向流程
   - 处理 SSO 回调

### 6.2 中优先级任务

5. **添加密码重置流程**
   - "忘记密码"页面
   - 邮箱发送重置 Token
   - Token 验证 + 密码修改

6. **实现会话字节流**
   - SessionPlayer 添加 stream API 支持
   - 用于高效获取录屏数据

7. **添加可信集群管理**
   - 可信集群列表页面
   - CRUD 操作
   - 集群切换功能

### 6.3 低优先级任务

8. 添加令牌管理页面
9. 添加访问请求页面
10. 添加系统健康页面
11. 完善品牌替换

---

## 7. 完成度总结

| 维度 | 完成度 | 说明 |
|------|--------|------|
| **核心功能** | 75% | 节点/用户/角色/会话/审计已基本完成 |
| **认证功能** | 50% | 本地认证已完成，SSO/2FA 未完成 |
| **资源管理** | 80% | CRUD 操作基本完成，部分连接功能需 CLI |
| **用户体验** | 60% | 缺少密码修改/重置/会话创建等关键功能 |
| **企业功能** | 30% | SSO/可信集群/连接器管理未完成 |
| **总体完成度** | **~65%** | 核心功能可用，企业功能需完善 |

---

## 8. API 覆盖率

| 指标 | 数量 | 百分比 |
|------|------|--------|
| 后端 Web API 端点总数 | ~55 | 100% |
| 前端已调用端点数 | 22 | 40% |
| 未调用端点数 | 33 | 60% |
| 高优先级未调用端点 | 5 | 9% |
| 中优先级未调用端点 | 5 | 9% |
| 低优先级未调用端点 | 23 | 42% |

---

> **报告结束**
> 建议优先完成高优先级功能，以提升用户体验和系统可用性。
