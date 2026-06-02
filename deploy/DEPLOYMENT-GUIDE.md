# Siriusec 部署与使用手册

> 基于 Teleport 架构的企业级身份感知访问代理平台

---

## 目录

1. [产品概述](#1-产品概述)
2. [核心架构](#2-核心架构)
3. [部署方式](#3-部署方式)
4. [配置详解](#4-配置详解)
5. [添加主机节点](#5-添加主机节点)
6. [添加数据库访问](#6-添加数据库访问)
7. [添加应用访问](#7-添加应用访问)
8. [用户管理](#8-用户管理)
9. [客户端使用](#9-客户端使用)
10. [运维管理](#10-运维管理)
11. [故障排查](#11-故障排查)
12. [安全最佳实践](#12-安全最佳实践)

---

## 1. 产品概述

### 1.1 什么是 Siriusec

Siriusec 是一个身份感知的多协议访问代理,支持以下协议:

- **SSH**: 远程服务器访问,浏览器中也支持 SSH
- **Kubernetes**: K8s 集群访问代理
- **Database**: MySQL、PostgreSQL 数据库代理
- **Application**: 内部 Web 应用访问代理
- **Network**: 网络服务器访问

### 1.2 核心特性

- **基于证书的访问**: 无需管理共享密钥,所有协议自动证书过期
- **多协议会话录制**: 支持命令和网络级别的会话记录/重放
- **RBAC 基于角色访问控制**: 灵活的权限管理
- **单点登录 (SSO)**: 支持 Github Auth、OpenID Connect、SAML
- **两因素认证 (2FA)**: 一切的两因素认证
- **会话共享**: 协作排查问题
- **基础设施内省**: CLI 或 Web UI 查看所有资源状态

### 1.3 适用场景

- 替换传统 `sshd` 设置
- 多环境多云资源安全访问
- 开发团队快速安全访问所需资源
- 审计日志和会话录制
- 跨团队、组织、数据中心信任管理

---

## 2. 核心架构

### 2.1 服务组件

Siriusec 由以下核心服务组成:

| 服务 | 默认端口 | 说明 |
|------|---------|------|
| **auth_service** | 3025 | 认证服务,管理用户、角色、证书颁发 |
| **proxy_service** | 3080 (Web), 3023 (SSH) | 代理服务,Web UI 和流量代理 |
| **ssh_service** | 3022 | SSH 服务,节点注册和 SSH 访问 |
| **db_service** | 3036 | 数据库代理服务,代理 MySQL/PostgreSQL |
| **app_service** | 动态 | 应用代理服务,代理内部 Web 应用 |

### 2.2 部署模式

#### 单节点模式 (All-in-One)

所有服务运行在一台机器上,适合测试和小规模部署:

```
┌─────────────────────────────┐
│      Single Node            │
│  ┌─────────┐ ┌───────────┐ │
│  │  Auth   │ │  Proxy    │ │
│  │  :3025  │ │ :3080     │ │
│  └─────────┘ └───────────┘ │
│  ┌─────────┐ ┌───────────┐ │
│  │  SSH    │ │   DB      │ │
│  │  :3022  │ │  :3036    │ │
│  └─────────┘ └───────────┘ │
└─────────────────────────────┘
```

#### 多节点模式 (生产推荐)

服务分散部署,提高可用性和扩展性:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Auth    │◄──►│  Proxy   │◄──►│   Node   │
│  :3025   │    │ :3080    │    │  :3022   │
└──────────┘    └──────────┘    └──────────┘
                                  ┌──────────┐
                                  │    DB    │
                                  │  :3036   │
                                  └──────────┘
```

### 2.3 数据流

```
用户 (tsh CLI / Web UI)
    │
    ▼
Proxy Service (:3080 Web, :3023 SSH)
    │
    ├──► Auth Service (:3025) - 认证授权
    │
    ├──► SSH Service (:3022) - SSH 节点
    │
    ├──► DB Service (:3036) - 数据库代理
    │
    └──► App Service - 应用代理
```

---

## 3. 部署方式

### 3.1 从源码构建

#### 环境要求

- Go 1.16 或更高版本
- 至少 1GB 虚拟内存 (512MB 无 swap 的实例**无法**编译)
- libpam0g-dev (PAM 支持)

#### 构建步骤

```bash
# 1. 克隆代码
git clone https://github.com/siriusec/siriusec.git
cd siriusec

# 2. 安装依赖
apt-get install -y libpam0g-dev

# 3. 编译
make full

# 或使用 CGO 手动编译
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go

CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh
chmod +x /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh

# 4. 创建数据目录
sudo mkdir -p -m0700 /var/lib/siriusec
sudo chown $USER /var/lib/siriusec
```

编译后的二进制文件位于: `$GOPATH/src/github.com/siriusec/siriusec/build`

### 3.2 Docker 部署

#### 使用 docker-compose

```yaml
# docker/docker-compose.yml
version: '2'
services:
  one:
    image: siriusec:latest
    container_name: one
    command: ${CONTAINERHOME}/build/teleport start -d -c ${CONTAINERHOME}/docker/one.yaml
    mem_limit: 300m
    ports:
      - "3080:3080"
      - "3023:3023"
      - "3025:3025"
    env_file: env.file
    volumes:
      - ./data/one:/var/lib/teleport
      - ../:/root/go/src/github.com/gravitational/teleport
      - certs:/mnt/shared/certs
    networks:
      siriusec:
        ipv4_address: 172.10.1.1

networks:
  siriusec:
    driver: bridge
    ipam:
      config:
      - subnet: 172.10.1.0/16
        gateway: 172.10.1.254

volumes:
  certs:
```

#### 启动命令

```bash
cd docker
docker-compose up -d one
```

### 3.3 二进制部署 (生产推荐)

#### 3.3.1 安装

```bash
# 下载并解压
tar -xzf siriusec-1.0.0-linux-amd64.tar.gz
cd siriusec

# 安装到系统路径
sudo ./install

# 验证安装
siriusec version
sctl version
tsh version
```

#### 3.3.2 生成 TLS 证书

```bash
mkdir -p /etc/siriusec/tls

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/siriusec/tls/server.key \
  -out /etc/siriusec/tls/server.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Siriusec/CN=your-server-ip" \
  -addext "subjectAltName=IP:your-server-ip"
```

#### 3.3.3 创建配置目录

```bash
mkdir -p /var/lib/siriusec /etc/siriusec/tls /var/log/siriusec
```

#### 3.3.4 快速启动 (单节点)

```bash
# 使用默认配置启动
sudo siriusec start

# 或指定配置文件
sudo siriusec start --config=/etc/siriusec/siriusec.yaml

# 调试模式
sudo siriusec start -d --config=/etc/siriusec/siriusec.yaml
```

#### 3.3.5 配置 systemd 服务

```bash
cat > /etc/systemd/system/siriusec.service << 'EOF'
[Unit]
Description=Siriusec Access Proxy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/siriusec start --config=/etc/siriusec/siriusec.yaml
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

# 重新加载并启用服务
sudo systemctl daemon-reload
sudo systemctl enable siriusec
sudo systemctl start siriusec

# 查看状态
sudo systemctl status siriusec
```

---

## 4. 配置详解

### 4.1 配置文件结构

Siriusec 使用 YAML 格式配置文件,主要结构如下:

```yaml
# 全局配置
teleport:
  nodename: <节点名称>
  advertise_ip: <广播 IP>
  data_dir: <数据目录>
  log:
    output: <日志输出>
    severity: <日志级别>

# 认证服务
auth_service:
  enabled: yes
  listen_addr: <监听地址>
  cluster_name: <集群名称>
  authentication:
    type: <认证类型>
    second_factor: <双因素认证>
  tokens:
    - <加入令牌>

# 代理服务
proxy_service:
  enabled: yes
  listen_addr: <监听地址>
  web_listen_addr: <Web 监听>
  public_addr: <公网地址>
  https_key_file: <TLS 私钥>
  https_cert_file: <TLS 证书>

# SSH 服务
ssh_service:
  enabled: yes
  listen_addr: <SSH 监听>
  labels:
    <标签键>: <标签值>
  commands:
    - name: <命令名称>
      command: [<命令>]
      period: <执行周期>

# 数据库服务
db_service:
  enabled: yes
  databases:
    - name: <数据库名称>
      protocol: <协议类型>
      uri: <连接 URI>
      static_labels:
        <标签键>: <标签值>
```

### 4.2 单节点完整配置示例

```yaml
# /etc/siriusec/siriusec.yaml
teleport:
  nodename: siriusec-node-01
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec/siriusec.log
    severity: INFO

auth_service:
  enabled: yes
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"  # 测试环境,生产建议开启
  tokens:
    - "node,proxy,app,db:join-token-2024"

ssh_service:
  enabled: yes
  listen_addr: 0.0.0.0:3022
  labels:
    env: production
    os: ubuntu
    version: "18.04"
    role: node
  commands:
    - name: hostname
      command: [/bin/hostname]
      period: 1m
    - name: kernel
      command: [/bin/uname, -r]
      period: 5m
    - name: uptime
      command: [/usr/bin/uptime]
      period: 1m

proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: 123.57.11.100:3080
  ssh_public_addr: 123.57.11.100:3023
  mysql_listen_addr: 0.0.0.0:3036
  mysql_public_addr: 123.57.11.100:3036
  https_key_file: /etc/siriusec/tls/server.key
  https_cert_file: /etc/siriusec/tls/server.crt

db_service:
  enabled: yes
  databases:
    - name: mysql-sample
      description: "Sample MySQL Database"
      protocol: mysql
      uri: 123.57.11.100:3506
      static_labels:
        env: production
        type: mysql
        team: backend
```

### 4.3 多节点配置示例

#### Auth 节点配置 (two-auth.yaml)

```yaml
teleport:
  nodename: two-auth
  advertise_ip: 172.10.1.2
  data_dir: /var/lib/teleport

auth_service:
  enabled: yes
  cluster_name: two
  tokens:
    - "node,auth,proxy:foo"
    - "trustedcluster:bar"
```

#### Proxy 节点配置 (two-proxy.yaml)

```yaml
teleport:
  nodename: two-proxy
  advertise_ip: 172.10.1.3
  data_dir: /var/lib/teleport

auth_service:
  enabled: no

proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:5080
  web_listen_addr: 0.0.0.0:5080
```

#### Node 节点配置 (two-node.yaml)

```yaml
teleport:
  nodename: two-node
  advertise_ip: 172.10.1.4
  data_dir: /var/lib/teleport

auth_service:
  enabled: no

ssh_service:
  enabled: yes
  labels:
    cluster: two
```

### 4.4 关键配置参数说明

#### teleport 全局配置

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `nodename` | 节点名称 | 主机名 |
| `advertise_ip` | 广播 IP,用于集群发现 | 自动检测 |
| `data_dir` | 数据存储目录 | /var/lib/siriusec |
| `log.output` | 日志输出 (stdout/文件) | stdout |
| `log.severity` | 日志级别 (DEBUG/INFO/WARN/ERROR) | INFO |

#### auth_service 认证服务

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | no |
| `listen_addr` | 监听地址 | 0.0.0.0:3025 |
| `cluster_name` | 集群名称 | 必填 |
| `authentication.type` | 认证类型 (local/oidc/saml) | local |
| `authentication.second_factor` | 双因素认证 (off/on/otp/u2f) | off |
| `tokens` | 加入集群令牌 | - |

#### proxy_service 代理服务

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | no |
| `listen_addr` | 代理监听地址 | 0.0.0.0:3023 |
| `web_listen_addr` | Web UI 监听地址 | 0.0.0.0:3080 |
| `public_addr` | 公网访问地址 | - |
| `ssh_public_addr` | SSH 公网访问地址 | - |
| `mysql_listen_addr` | MySQL 代理监听地址 | - |
| `https_key_file` | TLS 私钥文件 | - |
| `https_cert_file` | TLS 证书文件 | - |

#### ssh_service SSH 服务

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | no |
| `listen_addr` | SSH 监听地址 | 0.0.0.0:3022 |
| `labels` | 静态标签 | - |
| `commands` | 动态标签命令 | - |

#### db_service 数据库服务

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `enabled` | 是否启用 | no |
| `databases` | 数据库列表 | - |
| `databases[].name` | 数据库名称 (唯一) | - |
| `databases[].protocol` | 协议类型 (mysql/postgres) | - |
| `databases[].uri` | 数据库连接 URI | - |
| `databases[].static_labels` | 静态标签 | - |

---

## 5. 添加主机节点

### 5.1 添加本机作为节点

#### 步骤 1: 创建节点配置

```yaml
# /etc/siriusec/node-config.yaml
teleport:
  nodename: ubuntu-node-01
  advertise_ip: 0.0.0.0
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec/siriusec.log
    severity: INFO

ssh_service:
  enabled: yes
  listen_addr: 0.0.0.0:3022
  labels:
    env: production
    os: ubuntu
    version: "18.04"
    role: node
  commands:
    - name: hostname
      command: [/bin/hostname]
      period: 1m
    - name: kernel
      command: [/bin/uname, -r]
      period: 5m
    - name: uptime
      command: [/usr/bin/uptime]
      period: 1m
    - name: cpu_count
      command: [/bin/bash, -c, "nproc"]
      period: 10m
    - name: memory_total
      command: [/bin/bash, -c, "free -m | awk '/^Mem:/{print $2}'"]
      period: 10m
    - name: disk_usage
      command: [/bin/bash, -c, "df -h / | tail -1 | awk '{print $5}'"]
      period: 5m

auth_service:
  enabled: yes
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"
  tokens:
    - "node,proxy,app:join-token-2024"

proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: your-server-ip:3080
  ssh_public_addr: your-server-ip:3023
  mysql_listen_addr: 0.0.0.0:3036
  mysql_public_addr: your-server-ip:3036
  https_key_file: /etc/siriusec/tls/server.key
  https_cert_file: /etc/siriusec/tls/server.crt
```

#### 步骤 2: 启动服务

```bash
# 启动服务
sudo siriusec start --config=/etc/siriusec/node-config.yaml

# 或使用 systemd
sudo systemctl start siriusec
sudo systemctl status siriusec
```

### 5.2 添加远程主机节点

#### 步骤 1: 在目标主机上安装 Siriusec

```bash
# 在目标主机上执行
# 传输二进制文件
scp /usr/local/bin/siriusec root@target-host:/usr/local/bin/
scp /usr/local/bin/sctl root@target-host:/usr/local/bin/

# 或使用源码编译
cd /root/go/src/github.com/siriusec/siriusec
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
```

#### 步骤 2: 创建节点配置

```yaml
# /etc/siriusec/node-config.yaml (在目标主机上)
teleport:
  nodename: remote-node-01
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec/siriusec.log
    severity: INFO

ssh_service:
  enabled: yes
  listen_addr: 0.0.0.0:3022
  labels:
    env: production
    role: remote-node

# 连接到主集群的 Auth 服务
auth_service:
  enabled: no  # 不作为 auth 节点

proxy_service:
  enabled: no  # 不作为 proxy 节点
```

#### 步骤 3: 使用令牌加入集群

```bash
# 使用令牌加入集群
sudo siriusec start --token=join-token-2024 --auth-server=main-server-ip:3025
```

### 5.3 验证节点添加

```bash
# 使用 tsh 查看节点列表
tsh ls

# 应该能看到新添加的节点
# Name             Address        Labels
# ──────────────── ────────────── ──────────────────────────
# ubuntu-node-01   123.57.11.100  env=production,os=ubuntu
# remote-node-01   10.0.0.5       env=production,role=remote-node
```

---

## 6. 添加数据库访问

### 6.1 添加 MySQL 数据库

#### 步骤 1: 创建数据库配置

```yaml
# /etc/siriusec/db-config.yaml
teleport:
  nodename: db-proxy-01
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec/siriusec.log
    severity: INFO

auth_service:
  enabled: yes
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"
  tokens:
    - "node,proxy,db:join-token-2024"

proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: your-server-ip:3080
  mysql_listen_addr: 0.0.0.0:3036
  mysql_public_addr: your-server-ip:3036

ssh_service:
  enabled: yes
  listen_addr: 0.0.0.0:3022
  labels:
    env: production
    role: db-proxy

db_service:
  enabled: yes
  databases:
    - name: mysql-sample
      description: "Sample MySQL Database"
      protocol: mysql
      uri: 123.57.11.100:3506
      static_labels:
        env: production
        type: mysql
        team: backend
      dynamic_labels:
        - name: db_status
          command:
            - /bin/bash
            - -c
            - "echo 'running'"
          period: 5m
        - name: db_version
          command:
            - /bin/bash
            - -c
            - "mysql -h 123.57.11.100 -P 3506 -u sample -p'sample' -e 'SELECT VERSION()' 2>/dev/null || echo 'unknown'"
          period: 10m

    - name: mysql-business
      description: "Business Database MySQL"
      protocol: mysql
      uri: 123.57.11.100:3506
      static_labels:
        env: production
        type: mysql
        team: business
        region: cn-north
```

#### 步骤 2: 启动数据库代理服务

```bash
sudo siriusec start --config=/etc/siriusec/db-config.yaml
```

### 6.2 添加 PostgreSQL 数据库

```yaml
db_service:
  enabled: yes
  databases:
    - name: postgres-main
      description: "Main PostgreSQL Database"
      protocol: postgres
      uri: localhost:5432
      static_labels:
        env: production
        type: postgres
      # 可选: TLS CA 证书
      ca_cert_file: /etc/siriusec/certs/postgres-ca.pem
```

### 6.3 测试数据库访问

```bash
# 1. 查看可用数据库
tsh db ls

# 输出示例:
# Name             Description           Labels
# ──────────────── ───────────────────── ──────────────────────────
# mysql-sample     Sample MySQL Database env=production,type=mysql
# mysql-business   Business Database      env=production,type=mysql

# 2. 登录数据库
tsh db login --database=sample mysql-sample

# 3. 连接数据库 (需要本地安装 mysql 客户端)
tsh db connect mysql-sample

# 这会启动本地代理并自动连接 mysql
# 等效于: mysql -h 127.0.0.1 -P <local_port> -u sample -p'sample'

# 4. 在 mysql 中执行 SQL
SHOW DATABASES;
SELECT VERSION();
EXIT;
```

---

## 7. 添加应用访问

### 7.1 配置应用代理

```yaml
# /etc/siriusec/app-config.yaml
teleport:
  nodename: app-proxy-01
  data_dir: /var/lib/siriusec

app_service:
  enabled: yes
  apps:
    - name: grafana
      uri: http://localhost:3000
      public_addr: grafana.example.com
      insecure_skip_verify: true  # 如果后端使用自签名证书
      labels:
        env: production
        type: monitoring

    - name: prometheus
      uri: http://localhost:9090
      public_addr: prometheus.example.com
      labels:
        env: production
        type: monitoring
```

### 7.2 访问应用

```bash
# 查看可用应用
tsh apps ls

# 登录应用
tsh apps login grafana

# 打开应用 (会在浏览器中打开)
tsh apps config grafana
```

---

## 8. 用户管理

### 8.1 创建用户

```bash
# 创建管理员用户
sudo sctl users add admin --roles=editor,access --logins=root,ubuntu

# 输出示例:
# Setup a password
# Setup a temporary password for user admin.
# Your temporary password: xxxxxxxx
#
# Setup credentials using the signup token:
# https://your-server-ip:3080/web/invite/xxxxxxxxxxxxxxxx

# 使用浏览器访问该链接,设置密码
```

### 8.2 查看用户列表

```bash
# 查看所有用户
sudo sctl users ls

# 输出示例:
# User             Roles
# ──────────────── ──────────────
# admin            editor,access
# developer        developer
```

### 8.3 修改用户角色

```bash
# 更新用户角色
sudo sctl users update admin --roles=admin,editor,access

# 查看用户详情
sudo sctl users get admin
```

### 8.4 删除用户

```bash
sudo sctl users rm username
```

### 8.5 重置用户密码

```bash
sudo sctl users reset username
# 会生成新的注册链接
```

---

## 9. 客户端使用

### 9.1 安装 tsh 客户端

```bash
# tsh 是 Siriusec 的 CLI 客户端
# 已随 siriusec 一起编译安装

# 验证安装
tsh version
```

### 9.2 登录集群

```bash
# 基本登录
tsh --proxy=your-server-ip:3080 login

# 指定用户
tsh --proxy=your-server-ip:3080 login --user=admin

# 查看登录状态
tsh status
```

### 9.3 SSH 访问节点

```bash
# 查看所有节点
tsh ls

# SSH 到节点
tsh ssh root@ubuntu-node-01

# 指定身份
tsh ssh ubuntu@remote-node-01

# 执行远程命令
tsh ssh root@ubuntu-node-01 "ls -la /tmp"

# 文件传输
tsh scp file.txt root@ubuntu-node-01:/tmp/
```

### 9.4 数据库访问

```bash
# 查看数据库
tsh db ls

# 登录数据库
tsh db login mysql-sample

# 连接数据库
tsh db connect mysql-sample

# 注销数据库
tsh db logout mysql-sample
```

### 9.5 应用访问

```bash
# 查看应用
tsh apps ls

# 登录应用
tsh apps login grafana

# 获取应用 URL
tsh apps config grafana
```

### 9.6 会话录制和回放

```bash
# 查看会话列表
tsh play --list

# 回放会话
tsh play <session-id>
```

---

## 10. 运维管理

### 10.1 sctl 管理命令

```bash
# 查看所有命令
sudo sctl help

# 常用命令:
sudo sctl users ls           # 用户列表
sudo sctl roles ls           # 角色列表
sudo sctl nodes ls           # 节点列表
sudo sctl clusters ls        # 集群列表
sudo sctl sessions ls        # 会话列表
```

### 10.2 日志管理

```bash
# 查看系统日志
journalctl -u siriusec -n 100 --no-pager

# 实时跟踪日志
journalctl -u siriusec -f

# 查看 Siriusec 日志文件
tail -f /var/log/siriusec/siriusec.log

# 调试模式查看详细日志
siriusec start --config=/etc/siriusec/siriusec.yaml --debug
```

### 10.3 健康检查

```bash
# 检查服务状态
systemctl status siriusec

# 检查端口监听
netstat -tlnp | grep -E '3022|3025|3080|3036'

# 测试 Web UI
curl -k https://localhost:3080

# 检查数据目录
ls -la /var/lib/siriusec/
```

### 10.4 备份和恢复

```bash
# 备份数据目录
sudo tar -czf siriusec-backup-$(date +%Y%m%d).tar.gz /var/lib/siriusec

# 恢复数据
sudo systemctl stop siriusec
sudo tar -xzf siriusec-backup-20240101.tar.gz -C /
sudo systemctl start siriusec
```

### 10.5 证书管理

```bash
# 查看证书信息
ls -la /etc/siriusec/tls/

# 重新生成证书
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/siriusec/tls/server.key \
  -out /etc/siriusec/tls/server.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Siriusec/CN=your-server-ip" \
  -addext "subjectAltName=IP:your-server-ip"

# 重启服务使用新证书
sudo systemctl restart siriusec
```

---

## 11. 故障排查

### 11.1 Siriusec 启动失败

```bash
# 查看详细错误
siriusec start --config=/etc/siriusec/siriusec.yaml --debug

# 查看系统日志
journalctl -u siriusec -n 100 --no-pager

# 检查配置文件语法
cat /etc/siriusec/siriusec.yaml | python3 -c "import yaml,sys; yaml.safe_load(sys.stdin)"

# 检查数据目录权限
ls -la /var/lib/siriusec/
# 应该是 root:root 或 siriusec:siriusec,权限 0700
```

### 11.2 端口被占用

```bash
# 检查端口占用
netstat -tlnp | grep -E '3022|3025|3080|3036'

# 如果被占用,找到占用进程
lsof -i :3080

# 修改配置文件中的端口
# proxy_service:
#   web_listen_addr: 0.0.0.0:3081
```

### 11.3 无法访问 Web UI

```bash
# 检查防火墙
iptables -L -n | grep 3080

# 检查 SELinux
getenforce
# 如果启用,添加策略或关闭
setenforce 0  # 临时关闭

# 测试本地访问
curl -k https://localhost:3080

# 检查 TLS 证书
openssl x509 -in /etc/siriusec/tls/server.crt -text -noout
```

### 11.4 数据库连接失败

```bash
# 测试直连 MySQL
mysql -h 123.57.11.100 -P 3506 -u sample -p'sample' -e "SELECT 1"

# 检查 Siriusec 日志
grep -i "database\|mysql" /var/log/siriusec/siriusec.log

# 检查数据库服务是否启用
systemctl status siriusec | grep db_service
```

### 11.5 节点无法加入集群

```bash
# 检查令牌是否正确
# auth_service.tokens 中应包含节点使用的令牌

# 检查网络连通性
telnet auth-server-ip 3025

# 查看详细错误
siriusec start --token=join-token-2024 --auth-server=auth-server-ip:3025 --debug
```

### 11.6 常见错误码

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `data directory must be owned by user` | 数据目录权限不对 | `chown -R $USER /var/lib/siriusec` |
| `address already in use` | 端口被占用 | 修改配置中的端口或停止占用进程 |
| `certificate verify failed` | TLS 证书问题 | 重新生成证书或检查 CN |
| `access denied` | 权限不足 | 检查用户角色和 RBAC 配置 |
| `token expired` | 加入令牌过期 | 生成新令牌 |

---

## 12. 安全最佳实践

### 12.1 生产环境配置

```yaml
# 生产环境建议配置
auth_service:
  authentication:
    type: local
    second_factor: "on"  # 开启双因素认证
    # 或 second_factor: "otp"  # 仅 OTP

proxy_service:
  # 使用有效的 TLS 证书 (非自签名)
  https_key_file: /etc/letsencrypt/live/your-domain/privkey.pem
  https_cert_file: /etc/letsencrypt/live/your-domain/fullchain.pem
```

### 12.2 RBAC 角色设计

```yaml
# 示例: 定义不同角色
kind: role
metadata:
  name: developer
spec:
  allow:
    logins: [ubuntu, deploy]
    node_labels:
      env: ["dev", "staging"]
    rules:
      - resources: [node]
        verbs: [list, read]
  deny:
    node_labels:
      env: ["production"]
```

### 12.3 审计日志

Siriusec 提供以下审计功能:

- **命令录制**: 记录 SSH 会话中的所有命令
- **网络录制**: 记录网络级别的会话内容
- **会话回放**: 可以回放历史会话

查看审计日志:

```bash
# 通过 Web UI
# 访问 https://your-server-ip:3080/web/audit

# 通过 CLI
tsh play --list
```

### 12.4 定期安全审计

- 定期更新 Siriusec 版本
- 定期更换 TLS 证书
- 定期审计用户访问记录
- 定期审查 RBAC 角色权限
- 监控异常访问模式

---

## 附录

### A. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 3022 | SSH 服务 | SSH 节点监听 |
| 3023 | SSH 代理 | 客户端连接代理 |
| 3025 | Auth 服务 | 集群内部认证 |
| 3036 | MySQL 代理 | 数据库代理监听 |
| 3080 | Web UI | HTTPS Web 界面 |

### B. 常用命令速查

```bash
# 服务管理
sudo systemctl start siriusec
sudo systemctl stop siriusec
sudo systemctl restart siriusec
sudo systemctl status siriusec

# 用户管理
sudo sctl users add username --roles=editor,access --logins=root
sudo sctl users ls
sudo sctl users rm username

# 客户端使用
tsh --proxy=server-ip:3080 login
tsh ls
tsh ssh root@node-name
tsh db ls
tsh db connect db-name

# 故障排查
journalctl -u siriusec -f
tail -f /var/log/siriusec/siriusec.log
netstat -tlnp | grep siriusec
```

### C. 配置文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| 主配置文件 | /etc/siriusec/siriusec.yaml | Siriusec 主配置 |
| TLS 私钥 | /etc/siriusec/tls/server.key | HTTPS 私钥 |
| TLS 证书 | /etc/siriusec/tls/server.crt | HTTPS 证书 |
| 数据目录 | /var/lib/siriusec | 集群数据存储 |
| 日志文件 | /var/log/siriusec/siriusec.log | 运行日志 |
| systemd 服务 | /etc/systemd/system/siriusec.service | 服务配置 |

---

> **文档版本**: 1.0
> **更新日期**: 2026-05-26
> **基于版本**: Siriusec 1.0.0 (Teleport 架构)
