# Siriusec v7 Web API 接口文档

> 基于 `lib/web/apiserver.go` 整理，适用于前端独立开发。
>
> **Base URL**: `https://<host>:3080/v1`  
> **API 前缀**: 所有接口路径均以 `/v1` 为前缀（由路由层自动 strip）

---

## 认证方式

### 登录流程

1. 先访问任意 `/web/` 页面，从响应头中取出 `Set-Cookie: grv_csrf=<token>` 作为 CSRF Token
2. 使用 CSRF Token 调用登录接口，响应中同时设置 Session Cookie
3. 后续鉴权接口同时携带：
   - `Cookie: grv_csrf=<csrf_token>; <session_cookie>`
   - `X-CSRF-Token: <csrf_token>`（或 Header `Authorization: Bearer <token>`）

### 已登录请求头

```
Cookie: grv_csrf=<csrf>; grv_session=<user>;<session_id>
Authorization: Bearer <bearer_token>
```

---

## 一、公开接口（无需登录）

### 1.1 系统探测

#### GET /webapi/ping
检测服务是否在线，返回集群认证配置。

**响应示例：**
```json
{
  "auth": {
    "type": "local",
    "second_factor": "off",
    "u2f": {
      "app_id": "https://localhost:3080"
    }
  },
  "proxy": {
    "kube": { "enabled": false },
    "ssh": { "listen_addr": "0.0.0.0:3023", "public_addr": "" },
    "db": { "mysql_listen_addr": "" }
  },
  "server_version": "7.3.9",
  "min_client_version": "7.0.0",
  "cluster_name": "localhost"
}
```

#### GET /webapi/ping/:connector
查询指定认证连接器（OIDC/SAML/GitHub connector name）的配置，响应格式同上。

#### GET /webapi/find
轻量版 ping，供服务端节点自检用（不返回 OIDC connector 信息）。

#### GET /webapi/motd
获取登录前消息 (Message of the Day)。

**响应：**
```json
{ "motd": "Welcome message here" }
```

#### GET /.well-known/jwks.json
获取用于验证 JWT 的公钥集合（JWK Set）。

---

## 二、认证接口

### 2.1 创建 Web Session（登录）

#### POST /webapi/sessions
#### POST /webapi/sessions/web
> 需要 CSRF Token（Cookie + Header）

**请求：**
```json
{
  "user": "admin",
  "pass": "Xiaoxi@0109",
  "second_factor_token": ""
}
```

**响应（同时设置 Session Cookie）：**
```json
{
  "type": "bearer",
  "token": "b64-encoded-bearer-token",
  "expires_in": 43200,
  "sessionExpires": "2026-05-22T12:00:00Z",
  "sessionInactiveTimeout": 0
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 固定值 `"bearer"` |
| `token` | string | Bearer Token，用于 Authorization 头 |
| `expires_in` | int | Token 有效秒数 |
| `sessionExpires` | time | Session 过期时间（RFC3339） |
| `sessionInactiveTimeout` | int | 空闲超时毫秒数，0 表示无限制 |

---

### 2.2 注销

#### DELETE /webapi/sessions
> 需要登录

**响应：**
```json
{ "message": "ok" }
```

---

### 2.3 续期 Session

#### POST /webapi/sessions/renew
> 需要登录

**请求（可选字段）：**
```json
{
  "requestId": "",
  "switchback": false
}
```

- `requestId`：使用已审批的访问请求 ID 来扩展角色
- `switchback`：设为 `true` 可撤销扩展角色，恢复默认角色

**响应：** 同登录响应（包含新 Bearer Token）

---

### 2.4 创建 App Session

#### POST /webapi/sessions/app
> 需要登录

用于应用访问代理场景，为特定 App 创建 Session。

---

### 2.5 查询用户状态

#### GET /webapi/user/status
> 需要登录

检验当前 Session 是否有效。

**响应：**
```json
{ "message": "ok" }
```

---

## 三、用户管理

### 3.1 获取用户列表

#### GET /webapi/users
> 需要登录（需有 users:list 权限）

**响应：**
```json
[
  {
    "name": "admin",
    "roles": ["editor", "access", "auditor"],
    "authType": "local"
  }
]
```

---

### 3.2 创建用户

#### POST /webapi/users
> 需要登录

**请求：**
```json
{
  "name": "alice",
  "roles": ["access"],
  "traits": {
    "logins": ["alice", "root"]
  }
}
```

---

### 3.3 更新用户

#### PUT /webapi/users
> 需要登录

请求格式同创建，需包含 `name` 字段标识目标用户。

---

### 3.4 删除用户

#### DELETE /webapi/users/:username
> 需要登录

**响应：**
```json
{ "message": "ok" }
```

---

### 3.5 密码管理

#### GET /webapi/users/password/token/:token
无需登录，通过邀请/重置 Token 查询 Token 信息。

**响应：**
```json
{
  "tokenId": "abc123",
  "user": "alice",
  "qrCode": "base64-qr-code-if-otp"
}
```

#### PUT /webapi/users/password/token
> 需要 CSRF Token

使用重置 Token 修改密码（首次设置密码/忘记密码场景）。

**请求：**
```json
{
  "token": "reset-token",
  "password": "base64-encoded-new-password",
  "second_factor_token": "otp-if-required",
  "u2f_register_response": {}
}
```

**响应：** 同登录响应（自动建立 Session）

#### PUT /webapi/users/password
> 需要登录

修改已登录用户密码。

**请求：**
```json
{
  "old_password": "base64-old-password",
  "new_password": "base64-new-password",
  "second_factor_token": "otp-if-required"
}
```

#### POST /webapi/users/password/token
> 需要登录（管理员权限）

为指定用户生成密码重置 Token（发送邀请邮件）。

**请求：**
```json
{
  "name": "alice",
  "type": "invite"
}
```
`type` 可选值：`"invite"` | `"password"`

**响应：**
```json
{
  "token_id": "abc123",
  "expiry": "2026-05-22T10:00:00Z",
  "url": "https://localhost:3080/web/invite/abc123"
}
```

---

## 四、集群与节点

### 4.1 获取集群列表

#### GET /webapi/sites
> 需要登录

**响应：**
```json
[
  {
    "name": "localhost",
    "lastConnected": "2026-05-22T08:00:00Z",
    "status": "online",
    "nodeCount": 1,
    "publicURL": "localhost:3080",
    "authVersion": "7.3.9",
    "proxyVersion": "7.3.9"
  }
]
```

---

### 4.2 获取命名空间列表

#### GET /webapi/sites/:site/namespaces
> 需要登录

`:site` 为集群名称（如 `localhost`）

**响应：**
```json
{
  "namespaces": [
    { "kind": "namespace", "version": "v2", "metadata": { "name": "default" } }
  ]
}
```

---

### 4.3 获取节点列表

#### GET /webapi/sites/:site/namespaces/:namespace/nodes
> 需要登录

`:namespace` 通常为 `default`

**响应：**
```json
{
  "items": [
    {
      "id": "node-uuid",
      "siteId": "localhost",
      "hostname": "myserver",
      "addr": "10.0.0.1:3022",
      "tunnel": false,
      "tags": [
        { "name": "env", "value": "production" }
      ]
    }
  ]
}
```

---

### 4.4 获取用户上下文（含 ACL）

#### GET /webapi/sites/:site/context
> 需要登录

> 仅对 root cluster 有效

**响应：**
```json
{
  "authType": "local",
  "userName": "admin",
  "userAcl": {
    "sessions":        { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "authConnectors":  { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "roles":           { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "users":           { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "trustedClusters": { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "events":          { "list": true, "read": true, "edit": false, "create": false, "remove": false },
    "tokens":          { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "nodes":           { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "appServers":      { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "dbServers":       { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "kubeServers":     { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "sshLogins":       ["root", "admin"],
    "accessRequests":  { "list": true, "read": true, "edit": true, "create": true, "remove": true },
    "billing":         { "list": false, "read": false, "edit": false, "create": false, "remove": false }
  },
  "cluster": {
    "name": "localhost",
    "lastConnected": "2026-05-22T08:00:00Z",
    "status": "online",
    "nodeCount": 1,
    "publicURL": "localhost:3080",
    "authVersion": "7.3.9",
    "proxyVersion": "7.3.9"
  },
  "accessStrategy": {
    "type": "optional",
    "prompt": ""
  },
  "accessCapabilities": {
    "requestableRoles": [],
    "suggestedReviewers": []
  }
}
```

---

## 五、SSH 终端（WebSocket）

### 5.1 建立 SSH 终端连接

#### GET /webapi/sites/:site/namespaces/:namespace/connect
> WebSocket 升级，需要登录（Bearer Token 作为 query 参数）

**Query 参数：**
```
GET /v1/webapi/sites/localhost/namespaces/default/connect
  ?access_token=<bearer_token>
  &params=<url-encoded-json>
```

`params` 是 URL Encode 后的 JSON：
```json
{
  "server_id": "node-uuid-or-hostname",
  "login": "root",
  "term": { "h": 40, "w": 160 },
  "sid": ""
}
```

**WebSocket 消息格式（文本帧）：**
- 输入：JSON `{"type": "resize", "size": {"h": 40, "w": 160}}`
- 输出：二进制或文本终端数据

---

### 5.2 创建 Session 元数据

#### POST /webapi/sites/:site/namespaces/:namespace/sessions
> 需要登录

**请求：**
```json
{
  "session": {
    "server_id": "node-uuid",
    "login": "root",
    "terminal_params": { "w": 160, "h": 40 }
  }
}
```

**响应：**
```json
{
  "session": {
    "id": "session-uuid",
    "namespace": "default",
    "server_id": "node-uuid",
    "server_hostname": "myserver",
    "login": "root",
    "created": "2026-05-22T08:00:00Z",
    "last_active": "2026-05-22T08:00:00Z",
    "terminal_params": { "w": 160, "h": 40 }
  }
}
```

---

### 5.3 获取活跃 Session 列表

#### GET /webapi/sites/:site/namespaces/:namespace/sessions
> 需要登录

**响应：**
```json
{
  "sessions": [
    {
      "id": "session-uuid",
      "namespace": "default",
      "parties": [{ "user": "admin", "server_addr": "10.0.0.1:3022" }],
      "terminal_params": { "w": 160, "h": 40 },
      "login": "root",
      "created": "2026-05-22T08:00:00Z",
      "last_active": "2026-05-22T08:00:05Z",
      "server_id": "node-uuid",
      "server_hostname": "myserver",
      "cluster_name": "localhost"
    }
  ]
}
```

---

### 5.4 获取单个 Session

#### GET /webapi/sites/:site/namespaces/:namespace/sessions/:sid
> 需要登录

**响应：** 同列表中单个 session 对象。

---

## 六、审计日志

### 6.1 搜索事件

#### GET /webapi/sites/:site/events/search
> 需要登录

**Query 参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `from` | RFC3339 | 一个月前 | 开始时间 |
| `to` | RFC3339 | 当前时间 | 结束时间 |
| `limit` | int | 100 | 最大返回条数 |
| `order` | `desc`/`asc` | `desc` | 排序方向 |
| `include` | string | 所有 | 逗号分隔的事件类型过滤 |
| `startKey` | string | - | 分页游标（上次响应中的 `startKey`） |

**常用事件类型：**
- `session.start` / `session.end` / `session.join`
- `user.login` / `user.create` / `user.delete`
- `auth`
- `exec`
- `scp`
- `resize`

**响应：**
```json
{
  "events": [
    {
      "event": "session.start",
      "uid": "event-uuid",
      "time": "2026-05-22T08:00:00Z",
      "user": "admin",
      "login": "root",
      "server_id": "node-uuid",
      "server_hostname": "myserver",
      "namespace": "default",
      "session_id": "session-uuid",
      "addr.local": "10.0.0.1:3022",
      "addr.remote": "10.0.0.2:44321"
    }
  ],
  "startKey": "next-page-cursor"
}
```

---

### 6.2 获取录屏事件列表

#### GET /webapi/sites/:site/namespaces/:namespace/sessions/:sid/events
> 需要登录

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `after` | int | 返回序号大于此值的事件（用于轮询） |

**响应：**
```json
{
  "events": [
    { "event": "print", "data": "base64-terminal-data", "ms": 100, "offset": 0, "bytes": 512 },
    { "event": "resize", "terminal_size": "160:40", "ms": 200 }
  ],
  "startKey": ""
}
```

---

### 6.3 获取录屏原始流

#### GET /webapi/sites/:site/namespaces/:namespace/sessions/:sid/stream
> 需要登录（Bearer Token 作为 query 参数 `access_token`）

返回 gzip 压缩的二进制录屏流，`Content-Type: application/octet-stream`。

**Query 参数：**

| 参数 | 说明 |
|------|------|
| `offset` | 从第 N 字节开始 |
| `bytes` | 读取字节数（最大 512KB）|

---

## 七、文件传输（SCP）

### 7.1 下载文件

#### GET /webapi/sites/:site/namespaces/:namespace/nodes/:server/:login/scp
> 需要登录

**Query 参数：**

| 参数 | 说明 |
|------|------|
| `path` | 远程文件路径 |
| `filename` | 下载文件名（用于 Content-Disposition） |

---

### 7.2 上传文件

#### POST /webapi/sites/:site/namespaces/:namespace/nodes/:server/:login/scp
> 需要登录

**Query 参数：**

| 参数 | 说明 |
|------|------|
| `path` | 远程目标路径 |

**请求体：** `multipart/form-data`，字段名 `file`

---

## 八、应用访问

### 8.1 获取应用列表

#### GET /webapi/sites/:site/apps
> 需要登录

**响应：**
```json
{
  "items": [
    {
      "name": "grafana",
      "description": "Monitoring dashboard",
      "uri": "http://localhost:3000",
      "publicAddr": "grafana.example.com",
      "fqdn": "grafana.localhost",
      "clusterId": "localhost",
      "labels": [{ "name": "env", "value": "prod" }],
      "awsConsole": false
    }
  ]
}
```

---

### 8.2 获取 App FQDN

#### GET /webapi/apps/:fqdnHint
#### GET /webapi/apps/:fqdnHint/:clusterName/:publicAddr
> 需要登录

---

## 九、数据库访问

### 9.1 获取数据库列表

#### GET /webapi/sites/:site/databases
> 需要登录

**响应：**
```json
{
  "items": [
    {
      "name": "mydb",
      "desc": "Production MySQL",
      "protocol": "mysql",
      "type": "self-hosted",
      "labels": [{ "name": "env", "value": "prod" }]
    }
  ]
}
```

---

## 十、Kubernetes 访问

### 10.1 获取 Kube 集群列表

#### GET /webapi/sites/:site/kubernetes
> 需要登录

**响应：**
```json
{
  "items": [
    {
      "name": "mycluster",
      "labels": [{ "name": "env", "value": "prod" }]
    }
  ]
}
```

---

## 十一、角色管理

### 11.1 获取角色列表

#### GET /webapi/roles
> 需要登录

**响应：**
```json
[
  {
    "id": "role:editor",
    "kind": "role",
    "name": "editor",
    "content": "kind: role\nmetadata:\n  name: editor\n..."
  }
]
```

---

### 11.2 创建/更新角色

#### POST /webapi/roles
#### PUT /webapi/roles
> 需要登录

**请求：**
```json
{
  "kind": "role",
  "metadata": { "name": "my-role" },
  "spec": {
    "allow": {
      "logins": ["root"],
      "node_labels": { "*": "*" }
    }
  }
}
```

---

### 11.3 删除角色

#### DELETE /webapi/roles/:name
> 需要登录

---

## 十二、GitHub 连接器

### 12.1 获取连接器列表

#### GET /webapi/github
> 需要登录

**响应：** 同 roles 格式，`kind: github`

### 12.2 创建/更新

#### POST /webapi/github
#### PUT /webapi/github

### 12.3 删除

#### DELETE /webapi/github/:name

---

## 十三、可信集群

### 13.1 获取列表

#### GET /webapi/trustedcluster
> 需要登录

### 13.2 创建/更新

#### POST /webapi/trustedcluster
#### PUT /webapi/trustedcluster

### 13.3 删除

#### DELETE /webapi/trustedcluster/:name

---

## 十四、MFA/U2F

### 14.1 获取注册挑战

#### GET /webapi/u2f/signuptokens/:token
无需登录，用于 U2F 设备注册流程。

**响应：**
```json
{
  "token_id": "reset-token",
  "user": "alice",
  "qr_code": "base64-otp-qr-code",
  "u2f_register_request": {
    "challenge": "...",
    "appId": "https://localhost:3080",
    "registerRequests": [...]
  }
}
```

### 14.2 获取 MFA 挑战（登录用）

#### POST /webapi/u2f/signrequest
无需登录

**请求：**
```json
{ "user": "alice", "pass": "password" }
```

**响应：**
```json
{
  "webauthn_challenge": { "publicKey": { ... } },
  "totp_challenge": true
}
```

### 14.3 使用 MFA 创建 Session

#### POST /webapi/u2f/sessions
无需登录

**请求：**
```json
{
  "user": "alice",
  "webauthn_response": { ... },
  "totp_code": "123456"
}
```

### 14.4 使用 MFA 生成 SSH 证书

#### POST /webapi/u2f/certs
无需登录

### 14.5 修改密码时的 U2F 挑战

#### POST /webapi/u2f/password/changerequest
> 需要登录

---

## 十五、SSO 认证

### OIDC

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/webapi/oidc/login/web` | 发起 OIDC 登录（重定向到 IdP） |
| GET | `/webapi/oidc/callback` | OIDC 回调（IdP 重定向回来） |
| POST | `/webapi/oidc/login/console` | CLI 模式 OIDC 登录 |

### SAML

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/webapi/saml/acs` | SAML ACS 断言消费服务 |
| GET | `/webapi/saml/sso` | 发起 SAML SSO（重定向） |
| POST | `/webapi/saml/login/console` | CLI 模式 SAML 登录 |

### GitHub

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/webapi/github/login/web` | 发起 GitHub OAuth 登录 |
| GET | `/webapi/github/callback` | GitHub OAuth 回调 |
| POST | `/webapi/github/login/console` | CLI 模式 GitHub 登录 |

---

## 十六、SSH 证书

### 16.1 生成 SSH 临时证书

#### POST /webapi/ssh/certs
无需登录（密码验证）

**请求：**
```json
{
  "user": "alice",
  "password": "base64-password",
  "otp_token": "123456",
  "pub_key": "base64-public-key",
  "ttl": 3600000000000
}
```

**响应：**
```json
{
  "cert": "base64-signed-cert",
  "tls_cert": "base64-tls-cert",
  "host_signers": [
    {
      "domain_name": "localhost",
      "checking_keys": ["base64-public-key"]
    }
  ]
}
```

---

## 十七、前端配置

### 17.1 获取 Web 配置

#### GET /web/config.js
返回 JavaScript 格式的前端配置（不是 JSON）。

---

## 十八、可信集群验证（内部）

#### POST /webapi/trustedclusters/validate
用于集群间握手，前端无需使用。

#### POST /webapi/host/credentials
用于节点注册，前端无需使用。

---

## 附录：通用响应格式

### 成功（单对象）
```json
{ ...object fields... }
```

### 成功（列表，带 items 包装）
```json
{ "items": [ ...array... ] }
```

### 成功（无数据）
```json
{ "message": "ok" }
```

### 错误
```json
{
  "error": { "message": "bad auth credentials" },
  "message": "bad auth credentials"
}
```

**HTTP 状态码：**
- `200` 成功
- `400` 请求参数错误
- `401` 未认证
- `403` 无权限
- `404` 资源不存在
- `500` 服务端错误

---

## 附录：URL 重写规则

以下旧版路径会被自动重写（向前兼容，前端建议使用新路径）：

| 旧路径 | 新路径 |
|--------|--------|
| `/webapi/sites/:site/sessions/:sid` | `/webapi/sites/:site/namespaces/default/sessions/:sid` |
| `/webapi/sites/:site/sessions` | `/webapi/sites/:site/namespaces/default/sessions` |
| `/webapi/sites/:site/nodes` | `/webapi/sites/:site/namespaces/default/nodes` |
| `/webapi/sites/:site/connect` | `/webapi/sites/:site/namespaces/default/connect` |

---

## 附录：前端开发建议

### 认证流程

```
1. GET /web/login  →  解析 grv_csrf cookie
2. POST /v1/webapi/sessions/web  →  Bearer Token + Session Cookie
3. GET /v1/webapi/sites/:site/context  →  用户权限上下文
```

### 推荐状态管理

```
store: {
  auth: {
    bearerToken,
    csrfToken,
    user: UserContext,
  },
  cluster: {
    name,
    nodes[],
    sessions[],
  }
}
```

### WebSocket 终端

```
ws://localhost:3080/v1/webapi/sites/localhost/namespaces/default/connect
  ?access_token=<bearerToken>
  &params={"server_id":"uuid","login":"root","term":{"h":40,"w":160}}
```

> **注意**：HTTPS 下使用 `wss://`

### API 路径前缀

实际请求需加 `/v1` 前缀：
```
/v1/webapi/ping
/v1/webapi/sessions/web
/v1/webapi/sites/localhost/namespaces/default/nodes
```
