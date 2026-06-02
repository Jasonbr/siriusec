# Siriusec 生产环境架构指南

## 1. 架构总览

Siriusec 由三个核心服务组成，生产环境必须将它们分离部署，不能像在开发环境中那样单节点运行。

| 服务 | 状态 | 职责 |
|------|------|------|
| Auth Service | 有状态 | 管理 CA、用户身份、集群配置 |
| Proxy Service | 无状态 | 网关入口，处理所有连接 |
| Node/SSH Service | 有状态 | 被访问的目标节点 |

**证书认证模型**：采用双 CA 架构。User CA 负责签发用户证书，Node CA 负责签发节点证书。所有证书默认每 12 小时自动轮换，过期后自动续签。

**连接流**：用户 → Proxy(3080) → Auth(3025) → 目标节点(3022)。用户的所有操作都经过 Proxy 转发，Proxy 自身不持有任何持久状态，这是实现高可用的关键。

## 2. 网络拓扑

生产环境采用三层网络隔离架构：

```
公网 → DMZ(LB+Proxy) → 内网(Auth Pool) → 数据层(存储后端)
```

- **公网层**：部署 L4 负载均衡器，流量分发到 Proxy 池。Proxy 至少部署 2 个实例。
- **内网层**：部署 L4 负载均衡器，流量分发到 Auth 池。Auth 至少部署 2 个实例（DynamoDB 后端时最多 2 个）。
- **数据层**：后端存储独立部署，Auth 服务通过内网直连。

**Split DNS**：同一 `public_addr` 在内网解析到内部负载均衡器，在外网解析到外部负载均衡器。这样可以确保节点和 Proxy 之间走内网路径，降低延迟和带宽成本。

**TLS Routing**：推荐在生产环境启用。通过单个端口 443 处理 HTTPS、WebSocket、SSH、Kubernetes API 等所有协议，简化防火墙配置。

### 防火墙端口

| 端口 | 方向 | 用途 |
|------|------|------|
| 443/3080 | 入站 | HTTPS / Web UI / WebSocket / SSH |
| 3023 | 入站 | SSH 代理 |
| 3024 | 入站 | 反向隧道 |
| 3025 | Auth 内部 | gRPC Auth 服务 |
| 3021 | Proxy 内部 | Proxy Peering (gRPC) |
| 3022 | 出站 | SSH 到目标节点 |

## 3. 后端存储选型

后端存储是整个集群最关键的基础设施决策，直接影响可用性、扩展性和运维复杂度。

| 后端 | 多实例 Auth | 多区域 | 企业版 | 推荐场景 |
|------|------------|--------|--------|---------|
| DynamoDB | 是（最多 2） | 否 | 不需要 | AWS 单区域部署，最成熟 |
| PostgreSQL | 是 | 否 | 不需要 | 自建机房，需要 wal_level=logical + REPLICATION 角色，不兼容 pgbouncer |
| CockroachDB | 是 | 是 | 必须 | 多区域部署唯一选择，需要至少 3 区域 |
| Firestore | 是（最多 2） | 否 | 不需要 | GCP 部署 |
| etcd | 是 | 否 | 不需要 | 自建 etcd 集群，运维复杂度高 |
| SQLite | 否，单实例 | 否 | 不需要 | 仅开发 / 测试 |
| S3 / GCS | 不适用 | 不适用 | 不需要 | 仅用于会话记录存储 |

### DynamoDB 配置要点

- 推荐使用 On-Demand 模式，自动扩展无需预规划容量。
- 必须启用 PITR（Point-In-Time Recovery），用于灾难恢复。
- IAM 策略需要以下权限：`dynamodb:CreateTable`、`dynamodb:UpdateTable`、`dynamodb:DescribeTable`、`dynamodb:PutItem`、`dynamodb:GetItem`、`dynamodb:DeleteItem`、`dynamodb:Query`、`dynamodb:Scan`、`dynamodb:UpdateItem`。
- 由于 DynamoDB stream shard 限制，Auth 实例最多只能有 2 个。
- 配置示例：

```yaml
teleport:
  storage:
    type: dynamodb
    region: us-east-1
    table_name: teleport-prod
```

### PostgreSQL 配置要点

- 数据库参数必须设置 `wal_level = logical`。
- 需要创建具有 `REPLICATION` 角色的数据库用户。
- 不兼容 pgbouncer，Auth 服务必须直连 PostgreSQL。
- 配置示例：

```yaml
teleport:
  storage:
    type: postgres
    conn_string: postgresql://teleport:password@pg-host:5432/teleport?sslmode=verify-full
```

## 4. 高可用部署

### 硬件推荐

| 规模 | Auth | Proxy | 后端 |
|------|------|-------|------|
| < 1000 节点 | 1x m5.xlarge | 1x m5.xlarge | SQLite / PG |
| 1000 - 10000 节点 | 2x m8i.2xlarge | 2x m8i.2xlarge | DynamoDB / PG |
| > 10000 节点 | 2x m8i.2xlarge | 4x m8i.2xlarge | DynamoDB |

**关键系统参数**：

- `max_connections: 65000`
- `LimitNOFILE=65536`
- `cache.max_backoff: 12m`

### Proxy Peering（多 Proxy 协作）

当部署多个 Proxy 实例时，它们通过 gRPC 端口 3021 相互通信，协调节点连接和会话路由。

- 配置 `agent_connection_count: 2`，确保每个节点至少连接到 2 个 Proxy，实现高可用。
- 每个 Proxy 都会建立到所有 Agent 的连接，任何 Proxy 故障时，Agent 会自动切换到其他 Proxy。

### TLS 证书

**Let's Encrypt**：

- DNS-01 challenge 适用于高可用多实例场景，因为不需要每个实例单独响应 HTTP 挑战。
- ALPN-01 仅适用于单实例部署。

**手动证书**：

- 将证书文件放置在 `/etc/teleport-tls/tls.key` 和 `/etc/teleport-tls/tls.crt`。
- 配置示例：

```yaml
proxy_service:
  https_keypairs:
    - key_file: /etc/teleport-tls/tls.key
      cert_file: /etc/teleport-tls/tls.crt
```

## 5. 安全加固

### 认证

- 必须启用 2FA，配置 `second_factor: otp`（基于 TOTP 应用）或 `second_factor: u2f`（基于硬件密钥）。
- 启用 CA Pinning，客户端首次连接时记录 CA 公钥指纹，防止后续中间人攻击。
- 证书自动轮换周期为 12 小时，无需手动干预。

### RBAC

Siriusec 提供基于角色的访问控制，预置角色包括 `admin`、`editor`、`access`、`auditor`。

支持 Access Request 临时权限提升，用户可以申请临时访问高敏感节点，审批通过后才获得权限。

配置示例：

```yaml
kind: role
version: v4
metadata:
  name: developer
spec:
  allow:
    logins: [ubuntu]
    node_labels:
      env: [dev, staging]
    namespaces: [default]
```

### 会话记录

- `node` 模式：在目标节点上记录会话，性能开销最小，支持加入已有会话。
- `proxy` 模式：在 Proxy 上记录会话，适合节点资源受限的场景，但无法加入已有会话。
- `off`：不记录会话，仅用于特定合规豁免场景。

如果使用 S3 或 GCS 存储会话记录，必须启用 versioning 和 SSE-KMS 加密。

推荐生产环境使用 `node` 模式，并将会话记录持久化到 S3 或 GCS。

## 6. 部署配置示例

### Auth 节点配置（auth.yaml）

```yaml
teleport:
  nodename: siriusec-auth-1
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec.log
    severity: WARN
  storage:
    type: dynamodb
    region: us-east-1
    table_name: siriusec-prod
  cache:
    max_backoff: 12m

auth_service:
  enabled: yes
  cluster_name: siriusec.yourcompany.com
  listen_addr: 0.0.0.0:3025
  tokens:
    - "proxy,node:xxxx-yyyy-zzzz"
    - "trustedcluster:aaaa-bbbb-cccc"
  authentication:
    second_factor: otp

ssh_service:
  enabled: no

proxy_service:
  enabled: no
```

### Proxy 节点配置（proxy.yaml）

```yaml
teleport:
  nodename: siriusec-proxy-1
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec.log
    severity: WARN
  auth_servers: ["auth.internal.yourcompany.com:3025"]

auth_service:
  enabled: no

ssh_service:
  enabled: no

proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:3080
  public_addr: siriusec.yourcompany.com:3080
  https_keypairs:
    - key_file: /etc/siriusec-tls/tls.key
      cert_file: /etc/siriusec-tls/tls.crt
  peer_address: 0.0.0.0:3021
  peer_public_addr: siriusec-proxy-1.internal:3021
  agent_connection_count: 2
```

### Node 节点配置（node.yaml）

```yaml
teleport:
  nodename: siriusec-node-app-1
  data_dir: /var/lib/siriusec
  auth_servers: ["auth.internal.yourcompany.com:3025"]

auth_service:
  enabled: no

ssh_service:
  enabled: yes
  labels:
    env: production
    team: backend

proxy_service:
  enabled: no
```

### Systemd 服务文件

参考 `examples/systemd/production/` 目录下的 `auth.service`、`proxy.service`、`node.service`。

每个角色使用独立的 systemd unit 文件，关键配置：

- `LimitNOFILE=65536`
- `Restart=always`
- `ExecStart=/usr/local/bin/siriusec start -c /etc/siriusec.yaml`

## 7. Kubernetes 部署

### Helm Chart 配置

```yaml
clusterName: siriusec.yourcompany.com
chartMode: standalone
highAvailability:
  replicaCount: 2
certManager: true
proxy:
  service:
    type: LoadBalancer
```

### 重要注意事项

- 不要设置 CPU limits。CFS throttle 会导致级联故障，在高负载时 Pod 会被系统强制限制 CPU，引发超时和重试风暴。
- 内存 limits 设为 requests 的 2 倍，为突发负载保留缓冲。
- 使用 cert-manager 自动管理 TLS 证书，避免手动更新带来的中断风险。
- Auth Pod 使用 PersistentVolumeClaim，确保证书和临时数据在 Pod 重建后不丢失。

## 8. 可信集群（Trusted Clusters）

可信集群用于多集群互信场景，允许一个集群的用户访问另一个集群的节点。

建立可信关系需要双方交换 CA 证书，在 Auth 服务配置中指定对端集群的 CA 文件和隧道地址。

配置示例：

```yaml
trusted_clusters:
  - key_file: /etc/siriusec/remote-ca.pem
    tunnel_addr: remote-cluster.internal:3024
    allow_logins: [admin, ops]
```

## 9. 监控与运维

### 关键指标

需要持续监控以下指标：

- 活跃连接数：反映集群实时负载。
- 证书签发速率：Auth 服务的核心负载指标。
- Auth 服务响应延迟：p99 应控制在 100ms 以内。
- 会话记录存储使用量：用于容量规划。

### 日志

- 生产环境推荐使用 `severity: WARN`，减少 INFO 级别日志的磁盘和网络开销。
- 使用 logrotate 或 systemd journal 进行日志轮转，防止磁盘占满。
- 审计日志必须独立存储，保留期满足企业合规要求。

### 备份

Auth 服务的 CA 密钥是整个集群的安全核心。一旦丢失，所有已签发证书失效，等于集群毁灭。

- 定期导出 CA 证书：`tctl auth export --type=ca > ca-backup.pem`
- 后端存储启用 PITR（DynamoDB）或流复制（PostgreSQL），用于数据级灾难恢复。
- CA 密钥备份必须离线存储，使用硬件安全模块或加密存储服务。

## 10. 常见陷阱

1. **单节点 Auth**：Auth 服务挂掉等于整个集群不可用，生产环境必须至少部署 2 个实例。
2. **DynamoDB 3 个以上 Auth**：DynamoDB stream 的 shard 限制导致超过 2 个 Auth 实例时会出现竞争和冲突。
3. **pgbouncer**：PostgreSQL 后端不兼容 pgbouncer，Auth 服务必须直接连接数据库，不能使用连接池中间件。
4. **K8s CPU limits**：CFS throttle 会导致级联故障，生产环境 Pod 不要设置 CPU limits。
5. **数据目录在 /tmp**：默认数据目录如果配置在临时文件系统上，节点重启后所有本地状态丢失。
6. **关闭 2FA**：生产环境必须启用双因素认证，关闭 2FA 等于放弃最后一道安全防线。
7. **Proxy 会话记录模式**：选择 proxy 模式后，运维人员无法加入正在进行的会话进行协助或审计。
8. **自签名证书**：使用自签名证书会导致浏览器显示不安全警告，长期下来用户会养成忽略警告的习惯，增加中间人攻击风险。
