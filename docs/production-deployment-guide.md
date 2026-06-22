# Siriusec 生产环境部署指南

> 本文档提供生产环境的完整部署方案，包括数据库接入、SSH 节点接入、Kubernetes 集群接入。

**版本**: 1.0.0  
**适用场景**: 生产环境部署  
**最后更新**: 2026-06-10

---

## 目录

1. [架构概览](#架构概览)
2. [前置要求](#前置要求)
3. [核心服务部署](#核心服务部署)
4. [接入数据库](#接入数据库)
5. [接入 SSH 节点](#接入 ssh 节点)
6. [接入 Kubernetes 集群](#接入 kubernetes 集群)
7. [生产配置最佳实践](#生产配置最佳实践)
8. [监控和日志](#监控和日志)
9. [故障排除](#故障排除)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Siriusec Cluster                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Auth Server │  │  Proxy      │  │   Node      │         │
│  │   :3025     │  │  :3023/3080 │  │   :3022     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                    ↑
         │                    │                    │
    ┌────┴────┐          ┌───┴───┐          ┌────┴────┐
    │  Web UI │          │ SSH   │          │  DB     │
    │  Users  │          │ Nodes │          │ Servers │
    └─────────┘          └───────┘          └─────────┘
                                                    
    ┌─────────────────────────────────────────────┐
    │         Kubernetes Clusters                 │
    │   (通过 KubeAgent 接入)                      │
    └─────────────────────────────────────────────┘
```

---

## 前置要求

### 系统要求

- **操作系统**: Linux (Ubuntu 20.04+, CentOS 7+, RHEL 8+)
- **内存**: 最少 2GB RAM (推荐 4GB+)
- **CPU**: 2+ 核心
- **磁盘**: 10GB+ 可用空间
- **网络**: 开放的端口 (3022, 3023, 3025, 3080)

### 软件依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y curl gnupg2 software-properties-common

# CentOS/RHEL
sudo yum install -y curl gnupg2
```

---

## 核心服务部署

### 方案 A: 单节点部署（推荐起步）

适用于中小规模部署，所有服务运行在同一台服务器。

#### 1. 下载和安装

```bash
# 下载最新版本的 Siriusec
sudo curl -O https://siriusec.com/siriusec/download/latest/siriusec-1.0.0-linux-amd64.tar.gz
sudo tar -xzf siriusec-1.0.0-linux-amd64.tar.gz
sudo ./install

# 验证安装
which siriusec
siriusec version
```

#### 2. 创建数据目录

```bash
sudo mkdir -p /var/lib/siriusec
sudo chown $USER /var/lib/siriusec
```

#### 3. 配置 siriusec.yaml

编辑 `/etc/siriusec/siriusec.yaml`:

```yaml
teleport:
  nodename: "siriusec-prod-01"
  data_dir: /var/lib/siriusec
  log:
    output: file
    severity: INFO
    file_path: /var/log/siriusec/siriusec.log

auth_service:
  enabled: true
  listen_addr: 0.0.0.0:3025
  advertise_addr: <YOUR_PUBLIC_IP>:3025  # 修改为你的公网 IP
  cluster_name: "prod-cluster"
  authentication:
    type: local
    second_factor: off  # 生产环境建议启用：on
  tokens:
    - "node:node-token-123"
    - "auth:auth-token-123"
    - "proxy:proxy-token-123"

proxy_service:
  enabled: true
  listen_addr: 0.0.0.0:3023
  advertise_addr: <YOUR_PUBLIC_IP>:3023
  web_listen_addr: 0.0.0.0:3080
  web_addr: <YOUR_PUBLIC_IP>:3080
  tunnel_listen_addr: 0.0.0.0:3024
  
  # HTTPS 配置（生产环境必须）
  https_key_pair:
    cert: /etc/siriusec/tls/siriusec.crt
    key: /etc/siriusec/tls/siriusec.key

ssh_service:
  enabled: true
  listen_addr: 0.0.0.0:3022

db_service:
  enabled: true
```

#### 4. 配置 HTTPS 证书

```bash
# 创建 TLS 目录
sudo mkdir -p /etc/siriusec/tls

# 使用 Let's Encrypt (推荐)
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d siriusec.example.com

# 或使用自签名证书（仅测试）
sudo openssl req -x509 -newkey rsa:4096 -keyout /etc/siriusec/tls/siriusec.key \
  -out /etc/siriusec/tls/siriusec.crt -days 365 -nodes \
  -subj "/CN=siriusec.example.com"
```

#### 5. 启动服务

```bash
# 作为 systemd 服务运行
sudo systemctl enable siriusec
sudo systemctl start siriusec
sudo systemctl status siriusec

# 查看日志
sudo tail -f /var/log/siriusec/siriusec.log
```

### 方案 B: Kubernetes 部署（推荐大规模）

使用 Helm Chart 部署到生产 K8s 集群。

```bash
# 添加 Helm 仓库
helm repo add siriusec https://charts.siriusec.com
helm repo update

# 创建命名空间
kubectl create namespace siriusec

# 部署 Siriusec
helm install siriusec siriusec/siriusec-cluster \
  --namespace siriusec \
  --set auth.serviceType=LoadBalancer \
  --set proxy.serviceType=LoadBalancer \
  --set auth.replicaCount=3 \
  --set proxy.replicaCount=3 \
  --set node.replicaCount=3
```

---

## 接入数据库

### MySQL 数据库

#### 1. 在 siriusec.yaml 中配置

```yaml
db_service:
  enabled: true
  databases:
  - name: production-mysql
    protocol: mysql
    uri: mysql://user:password@192.168.1.100:3306
    labels:
      env: production
      team: backend
      app: user-service
```

#### 2. 或者使用资源文件

创建 `/var/lib/siriusec/resources/mysql.yaml`:

```yaml
kind: db
version: v2
metadata:
  name: production-mysql
  labels:
    env: production
    team: backend
spec:
  original_name: mysql-prod-01
  protocol: mysql
  uri: mysql://user:password@192.168.1.100:3306
```

#### 3. 通过 Web UI 或 API 添加

```bash
# 使用 tsh CLI
tsh db add production-mysql \
  --protocol=mysql \
  --uri=mysql://user:password@192.168.1.100:3306 \
  --labels=env=production,team=backend
```

### PostgreSQL 数据库

```yaml
databases:
- name: production-postgres
  protocol: postgres
  uri: postgres://user:password@192.168.1.101:5432/mydb
  labels:
    env: production
    team: analytics
```

---

## 接入 SSH 节点

### 方案 A: 使用 Node Token（推荐）

#### 1. 生成 Node Token

```bash
# 在 Auth 服务器上
siriusecctl auth token --type=node --ttl=24h
# 输出：node:eyJhbG...
```

#### 2. 在目标服务器上安装 Siriusec Node

```bash
# 安装
curl -O https://siriusec.com/siriusec/download/latest/siriusec-1.0.0-linux-amd64.tar.gz
tar -xzf siriusec-1.0.0-linux-amd64.tar.gz
sudo ./install

# 配置 node.yaml
cat > /etc/siriusec/node.yaml <<EOF
teleport:
  nodename: "prod-web-01"
  data_dir: /var/lib/siriusec
  log:
    output: file
    severity: INFO

auth_service:
  enabled: false

proxy_service:
  enabled: false

ssh_service:
  enabled: true
  listen_addr: 0.0.0.0:3022

token: node:eyJhbG...  # 替换为实际 token
EOF

# 启动节点
sudo systemctl enable siriusec
sudo systemctl start siriusec
```

#### 3. 批量部署（使用配置管理工具）

**Ansible 示例**:

```yaml
# playbook.yml
- name: Deploy Siriusec Nodes
  hosts: webservers
  become: yes
  tasks:
    - name: Install Siriusec
      ansible.builtin.get_url:
        url: https://siriusec.com/siriusec/download/latest/siriusec-1.0.0-linux-amd64.tar.gz
        dest: /tmp/siriusec.tar.gz
      
    - name: Extract and install
      ansible.builtin.shell: |
        tar -xzf /tmp/siriusec.tar.gz
        ./install
      args:
        chdir: /tmp
      
    - name: Configure node
      ansible.builtin.template:
        src: node.yaml.j2
        dest: /etc/siriusec/siriusec.yaml
      
    - name: Start service
      ansible.builtin.systemd:
        name: siriusec
        state: started
        enabled: yes
```

### 方案 B: 使用 Auto-Discovery（大规模部署）

```yaml
# 在 siriusec.yaml 中配置
ssh_service:
  enabled: true
  automatic_token: true  # 自动为注册的节点生成 token
```

---

## 接入 Kubernetes 集群

### 方案 A: 使用 KubeAgent（推荐）

#### 1. 生成 KubeAgent Token

```bash
siriusecctl auth token --type=kube --ttl=24h
# 输出：kube:eyJhbG...
```

#### 2. 在目标 K8s 集群中部署 KubeAgent

```bash
# 创建命名空间
kubectl create namespace siriusec

# 部署 KubeAgent
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: siriusec-config
  namespace: siriusec
data:
  siriusec.yaml: |
    teleport:
      nodename: "k8s-prod-cluster"
      data_dir: /var/lib/siriusec
    auth_service:
      enabled: false
    proxy_service:
      enabled: false
    kube_service:
      enabled: true
      token: kube:eyJhbG...  # 替换为实际 token
EOF

# 部署 StatefulSet
kubectl apply -f https://siriusec.com/charts/kube-agent/kube-agent.yaml
```

#### 3. 使用 Helm 部署

```bash
helm repo add siriusec https://charts.siriusec.com
helm install kube-agent siriusec/siriusec-kube-agent \
  --namespace siriusec \
  --set token=kube:eyJhbG... \
  --set clusterName=prod-cluster-01
```

### 方案 B: 直接集成（K8s 集群运行 Siriusec）

如果 K8s 集群中已经运行了 Siriusec，可以直接配置:

```yaml
# 在 siriusec.yaml 中
kube_service:
  enabled: true
  kubeconfig: /etc/kubernetes/admin.conf
  clusters:
  - name: prod-cluster
    api_addr: https://kubernetes.default:443
    labels:
      env: production
      region: us-east-1
```

---

## 生产配置最佳实践

### 1. 安全加固

```yaml
# 强制启用 2FA
auth_service:
  authentication:
    type: local
    second_factor: on  # 生产环境必须启用

# 限制访问源 IP
proxy_service:
  web_insecure_grpc_skip_verify: false
  allowed_web_origins:
    - https://siriusec.example.com

# 审计日志
teleport:
  audit:
    enabled: true
    log:
      output: file
      file_path: /var/log/siriusec/audit.log
```

### 2. 高可用配置

```yaml
# 多 Auth 服务器配置
auth_service:
  enabled: true
  listen_addr: 0.0.0.0:3025
  cluster_name: "prod-cluster"
  
  # 外部存储后端（推荐 etcd 或 Postgres）
  backend:
    type: etcd
    etcd:
      endpoints:
        - https://etcd-0:2379
        - https://etcd-1:2379
        - https://etcd-2:2379
      ca_cert: /etc/etcd/etcd-ca.crt
      cert: /etc/etcd/etcd-client.crt
      key: /etc/etcd/etcd-client.key
```

### 3. 监控和告警

```yaml
# Prometheus 指标暴露
teleport:
  prometheus:
    enabled: true
    listen_addr: 0.0.0.0:3029
```

### 4. 备份策略

```bash
# 定期备份数据目录
0 2 * * * /usr/bin/tar -czf /backup/siriusec-$(date +\%Y\%m\%d).tar.gz /var/lib/siriusec

# 备份审计日志
0 3 * * * /usr/bin/tar -czf /backup/audit-$(date +\%Y\%m\%d).tar.gz /var/log/siriusec/audit.log
```

---

## 监控和日志

### Prometheus + Grafana

**prometheus.yml**:

```yaml
scrape_configs:
  - job_name: 'siriusec'
    static_configs:
      - targets: ['siriusec-auth:3029']
    metrics_path: /metrics
```

**Grafana Dashboard**: 导入 dashboard ID 12345

### 日志聚合

```yaml
# 配置日志输出到 syslog 或外部服务
teleport:
  log:
    output: syslog
    severity: INFO
```

---

## 故障排除

### 常见问题

#### 1. 服务启动失败

```bash
# 检查日志
sudo journalctl -u siriusec -f

# 检查端口占用
sudo lsof -i :3025
sudo lsof -i :3080
```

#### 2. 节点无法连接

```bash
# 验证 token 有效性
siriusecctl auth token verify <token>

# 检查网络连接
telnet <auth-server> 3025
```

#### 3. Web UI 无法访问

```bash
# 检查 HTTPS 证书
openssl x509 -in /etc/siriusec/tls/siriusec.crt -text -noout

# 检查防火墙
sudo ufw status
sudo firewall-cmd --list-all
```

### 调试模式

```bash
# 启用详细日志
sudo siriusecctl config set log.severity DEBUG

# 重启服务
sudo systemctl restart siriusec
```

---

## 参考资料

- [Siriusec 官方文档](https://siriusec.com/docs)
- [快速开始指南](https://siriusec.com/docs/quickstart)
- [管理员手册](https://siriusec.com/docs/admin-guide)
- [Kubernetes 集成](https://siriusec.com/docs/kubernetes-access)
- [数据库访问](https://siriusec.com/docs/database-access)

---

## 下一步

1. ✅ 部署核心服务
2. ✅ 接入生产数据库
3. ✅ 接入 SSH 节点
4. ✅ 接入 Kubernetes 集群
5. ⏭️ 配置监控和告警
6. ⏭️ 实施备份策略
7. ⏭️ 定期进行安全审计
