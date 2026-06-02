# Ubuntu 18.04.6 LTS 部署指南

## 服务器信息

- **服务器**: 123.57.11.100
- **SSH**: 端口 22, 账号 root/root@123hs
- **MySQL**: 端口 3506, 账号 sample/sample

## 前置条件

已上传到服务器的文件:
- `/tmp/siriusec-src-full.tar.gz` - 完整源码包 (17MB,包含 vendor)
- `/tmp/build-on-server.sh` - 编译部署脚本

## 部署步骤

### 方式一: 使用已上传的脚本 (推荐)

```bash
# 1. SSH 登录服务器
ssh -p 22 root@123.57.11.100
# 密码: root@123hs

# 2. 确保 Go 已安装
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go
go version  # 应显示 go1.16.15

# 3. 安装 PAM 开发包 (如果尚未安装)
apt-get update
apt-get install -y libpam0g-dev

# 4. 运行编译部署脚本
chmod +x /tmp/build-on-server.sh
bash /tmp/build-on-server.sh

# 5. 验证安装
ls -lh /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh
/usr/local/bin/siriusec version
```

### 方式二: 手动编译

```bash
# 1. 登录并设置环境
ssh -p 22 root@123.57.11.100
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go

# 2. 解压源码
rm -rf /root/go/src/github.com/siriusec/siriusec
mkdir -p /root/go/src/github.com/siriusec/siriusec
cd /root/go/src/github.com/siriusec/siriusec
tar xzf /tmp/siriusec-src-full.tar.gz

# 3. 安装依赖
apt-get install -y libpam0g-dev

# 4. 创建必要目录
mkdir -p /var/lib/siriusec /etc/siriusec /var/log/siriusec

# 5. 编译
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh

# 6. 设置权限
chmod +x /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh
```

## 配置 Siriusec

### 创建配置文件

```bash
cat > /etc/siriusec/siriusec.yaml << 'EOF'
teleport:
  nodename: node-01
  data_dir: /var/lib/siriusec
  log:
    output: stderr
    severity: INFO
    format:
      output: text

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

### 启动服务

```bash
# 直接启动
siriusec start --config=/etc/siriusec/siriusec.yaml

# 或使用 systemd (需要创建服务文件)
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

systemctl daemon-reload
systemctl enable siriusec
systemctl start siriusec
systemctl status siriusec
```

## 客户端包

客户端需要使用 `tsh` 工具连接服务器:

```bash
# 在客户端机器上 (macOS 或 Linux)
# 下载 tsh 二进制文件或从 build 目录复制

# 连接到 Siriusec 服务器
tsh --proxy=123.57.11.100:3080 login

# 查看集群状态
tsh --proxy=123.57.11.100:3080 status

# SSH 到节点
tsh --proxy=123.57.11.100:3080 ssh root@node-name
```

## 验证部署

```bash
# 1. 检查服务是否运行
ps aux | grep siriusec
systemctl status siriusec

# 2. 检查端口监听
netstat -tlnp | grep -E '3025|3022|3080'

# 3. 测试 Web UI
curl -k https://localhost:3080

# 4. 查看日志
tail -f /var/lib/siriusec/log/siriusec.log
```

## MySQL 数据库配置

如果 Siriusec 需要连接 MySQL 数据库:

```bash
# 测试 MySQL 连接
mysql -h 123.57.11.100 -P 3506 -u sample -p'sample'

# 创建 Siriusec 数据库 (如果需要)
mysql -h 123.57.11.100 -P 3506 -u sample -p'sample' << 'EOF'
CREATE DATABASE IF NOT EXISTS siriusec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON siriusec.* TO 'sample'@'%';
FLUSH PRIVILEGES;
EOF
```

## 故障排除

### 编译失败

```bash
# 检查 Go 版本
go version  # 需要 1.16+

# 检查 vendor 目录
ls vendor/ | wc -l  # 应有多个包

# 检查 CGO
CGO_ENABLED=1 go env CGO_ENABLED  # 应为 1

# 检查 PAM 头文件
ls /usr/include/security/pam_appl.h
```

### 服务启动失败

```bash
# 查看详细日志
siriusec start --debug --config=/etc/siriusec/siriusec.yaml

# 检查数据目录权限
ls -la /var/lib/siriusec
chown -R root:root /var/lib/siriusec
chmod 700 /var/lib/siriusec
```

## 端口说明

| 端口 | 用途 |
|------|------|
| 3025 | Auth 服务 |
| 3022 | SSH 服务 |
| 3080 | Web UI / Proxy |

## 访问地址

- Web UI: https://123.57.11.100:3080
- Auth: 123.57.11.100:3025
- SSH: 123.57.11.100:3022
