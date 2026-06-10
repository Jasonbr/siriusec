# Ubuntu 18.04.6 LTS 部署和验证指南

## 概述

本文档用于指导如何在 Ubuntu 18.04.6 LTS 服务器上部署 Siriusec 节点包,并验证新旧平台的业务数据。

## 服务器信息

| 项目 | 信息 |
|------|------|
| 服务器地址 | 123.57.11.100 |
| SSH 端口 | 22 |
| SSH 账号 | root / root@123hs |
| MySQL 地址 | 123.57.11.100 |
| MySQL 端口 | 3506 |
| MySQL 账号 | sample / sample |

## 部署文件清单

以下文件已准备在 `deploy/` 目录中:

```
deploy/
├── build-on-server.sh      # 服务器端编译部署脚本
├── compare-platforms.sh    # 新旧平台数据对比脚本
├── DEPLOY_GUIDE.md         # 详细部署指南
├── ubuntu-deploy.sh        # Ubuntu 部署脚本 (备选)
└── validate-databases.sql  # 数据库验证 SQL 脚本
```

## 快速部署步骤

### 1. 连接到服务器

```bash
ssh -p 22 root@123.57.11.100
# 密码: root@123hs
```

### 2. 编译和安装 Siriusec

```bash
# 设置 Go 环境
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go

# 运行编译脚本
bash /tmp/build-on-server.sh
```

**或者手动编译:**

```bash
# 解压源码 (如果尚未解压)
mkdir -p /root/go/src/github.com/siriusec/siriusec
cd /root/go/src/github.com/siriusec/siriusec
tar xzf /tmp/siriusec-src-full.tar.gz

# 安装 PAM 开发包
apt-get install -y libpam0g-dev

# 编译
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh

# 设置权限
chmod +x /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh
```

### 3. 创建配置文件

```bash
mkdir -p /etc/siriusec /var/lib/siriusec /var/log/siriusec

cat > /etc/siriusec/siriusec.yaml << 'EOF'
siriusec:
  nodename: node-01
  data_dir: /var/lib/siriusec
  log:
    output: stderr
    severity: INFO

auth_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"

ssh_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3022

proxy_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: 123.57.11.100:3080
EOF
```

### 4. 启动服务

```bash
# 直接启动
siriusec start --config=/etc/siriusec/siriusec.yaml

# 或使用 systemd
systemctl start siriusec
systemctl status siriusec
```

### 5. 验证部署

```bash
# 检查进程
ps aux | grep siriusec

# 检查端口
netstat -tlnp | grep -E '3025|3022|3080'

# 测试 Web UI
curl -k https://localhost:3080
```

## 客户端工具使用

### tsh 客户端

```bash
# 登录
tsh --proxy=123.57.11.100:3080 login

# 查看状态
tsh --proxy=123.57.11.100:3080 status

# SSH 连接
tsh --proxy=123.57.11.100:3080 ssh root@node-name

# 查看节点
tsh --proxy=123.57.11.100:3080 ls
```

### sctl 管理工具

```bash
# 查看集群状态
sctl status

# 管理用户
sctl users add admin --roles=admin
```

## 数据库验证

### 连接到 MySQL

```bash
MYSQL_PWD='sample' mysql -h 123.57.11.100 -P 3506 -u sample
```

### 运行验证脚本

```bash
MYSQL_PWD='sample' mysql -h 123.57.11.100 -P 3506 -u sample < deploy/validate-databases.sql
```

### 运行对比脚本

```bash
bash deploy/compare-platforms.sh
```

## 新旧平台数据对比

### 对比步骤

1. **连接两个平台的数据库**
   ```bash
   # 旧平台数据库
   mysql -h 123.57.11.100 -P 3506 -u sample -p -D old_platform_db

   # 新平台数据库
   mysql -h 123.57.11.100 -P 3506 -u sample -p -D siriusec_db
   ```

2. **对比用户数据**
   ```sql
   -- 旧平台用户数
   SELECT COUNT(*) as old_users FROM old_users_table;

   -- 新平台用户数
   SELECT COUNT(*) as new_users FROM new_users_table;
   ```

3. **对比会话/审计记录**
   ```sql
   -- 旧平台
   SELECT COUNT(*) FROM old_sessions WHERE created_at > '2024-01-01';

   -- 新平台
   SELECT COUNT(*) FROM new_sessions WHERE created_at > '2024-01-01';
   ```

4. **验证数据完整性**
   - 检查是否有重复记录
   - 检查外键关系
   - 验证时间戳是否连续

## 常见问题

### 编译失败

```bash
# 检查 Go 版本
go version  # 需要 1.16+

# 检查 PAM 头文件
ls /usr/include/security/pam_appl.h

# 安装缺失的依赖
apt-get install -y build-essential libpam0g-dev git
```

### 服务无法启动

```bash
# 查看详细日志
siriusec start --debug --config=/etc/siriusec/siriusec.yaml

# 检查目录权限
ls -la /var/lib/siriusec
chmod 700 /var/lib/siriusec
```

### 无法访问 Web UI

```bash
# 检查防火墙
iptables -L -n | grep 3080
ufw status 2>/dev/null || echo "ufw not installed"

# 检查服务监听
netstat -tlnp | grep 3080
```

## 端口清单

| 端口 | 协议 | 用途 |
|------|------|------|
| 3025 | TCP | Auth 服务 (集群内部通信) |
| 3023 | TCP | Proxy 服务 (客户端连接) |
| 3022 | TCP | SSH 服务 |
| 3080 | HTTPS | Web UI 和 API |

## 访问地址

- **Web UI**: https://123.57.11.100:3080
- **API**: https://123.57.11.100:3080/v1
- **Auth**: 123.57.11.100:3025
- **SSH**: 123.57.11.100:3022

## 日志位置

- 数据目录: `/var/lib/siriusec`
- 日志目录: `/var/log/siriusec`
- 配置文件: `/etc/siriusec/siriusec.yaml`

## 下一步

1. 完成部署后,登录 Web UI 创建管理员账号
2. 配置 SSO (可选)
3. 添加节点到集群
4. 测试 SSH 和数据库访问
5. 验证审计日志功能
6. 完成新旧平台数据迁移验证
