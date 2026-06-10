# 添加主机节点和数据库 - 快速操作指南

## 重要说明

由于自动化工具的 SSH/MySQL 连接输出存在问题,**您需要手动执行以下步骤**。

所有配置文件和脚本已准备就绪,您只需复制到服务器并执行。

---

## 第一步:上传文件到服务器

```bash
# 在您的本地机器上执行
cd /Users/xiaoxi/Downloads/workspace/siriusec/deploy/

scp -P 22 setup-node-and-db.sh node-config.yaml database-config.yaml root@123.57.11.100:/tmp/
# 密码: root@123hs
```

---

## 第二步: SSH 登录服务器

```bash
ssh -p 22 root@123.57.11.100
# 密码: root@123hs
```

---

## 第三步: 一键配置 (推荐)

登录后,直接运行:

```bash
chmod +x /tmp/setup-node-and-db.sh
bash /tmp/setup-node-and-db.sh
```

这个脚本会:
1. 检查 siriusec 是否已编译安装
2. 创建必要的目录
3. 生成 TLS 证书
4. 创建主机节点配置
5. 创建数据库配置 (MySQL 123.57.11.100:3506)
6. 创建完整配置文件 (节点+数据库)
7. 设置 systemd 服务
8. 启动服务并显示状态

---

## 第四步: 手动配置 (如果脚本失败)

### 4.1 确认 siriusec 已编译

```bash
export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go

# 检查二进制文件
ls -lh /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh

# 如果没有,先编译
cd /root/go/src/github.com/siriusec/siriusec
apt-get install -y libpam0g-dev
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh
chmod +x /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh
```

### 4.2 创建配置目录

```bash
mkdir -p /var/lib/siriusec /etc/siriusec/tls /var/log/siriusec
```

### 4.3 生成 TLS 证书

```bash
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/siriusec/tls/server.key \
  -out /etc/siriusec/tls/server.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Siriusec/CN=123.57.11.100" \
  -addext "subjectAltName=IP:123.57.11.100"
```

### 4.4 创建主配置文件

```bash
cat > /etc/siriusec/siriusec.yaml << 'EOF'
# Siriusec 完整配置 (节点 + 数据库)

siriusec:
  nodename: siriusec-node-01
  data_dir: /var/lib/siriusec
  log:
    output: /var/log/siriusec/siriusec.log
    severity: INFO

# Auth 服务
auth_service:
  enabled: yes
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"
  tokens:
    - "node,proxy,app,db:join-token-2024"

# SSH 服务 - 主机节点
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

# Proxy 服务
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

# 数据库服务 - MySQL
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
        team: sample
EOF
```

### 4.5 创建 systemd 服务

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

systemctl daemon-reload
systemctl enable siriusec
```

### 4.6 启动服务

```bash
# 直接启动
siriusec start --config=/etc/siriusec/siriusec.yaml

# 或使用 systemd
systemctl start siriusec
systemctl status siriusec
```

---

## 第五步: 业务测试

### 5.1 创建管理员用户

```bash
# 在服务器上执行
sctl users add admin --roles=editor,access --logins=root,ubuntu
```

会输出一个注册链接,类似:
```
https://123.57.11.100:3080/web/invite/xxxxx
```

在浏览器中打开该链接,设置密码。

### 5.2 测试主机节点 SSH 访问

**使用 tsh 客户端 (需要本地安装):**

```bash
# 1. 登录
tsh --proxy=123.57.11.100:3080 login

# 2. 查看节点列表 - 应该能看到 ubuntu-node-01
tsh ls

# 3. SSH 到节点
tsh ssh root@ubuntu-node-01

# 4. 查看节点信息
tsh status
```

**使用 Web UI:**

1. 打开浏览器访问: https://123.57.11.100:3080
2. 使用管理员账号登录
3. 点击左侧 "Servers" 或 "Nodes" 查看节点
4. 点击节点旁的 "Connect" 直接在浏览器中 SSH

### 5.3 测试数据库访问

**使用 tsh 客户端:**

```bash
# 1. 查看可用数据库
tsh db ls

# 应该能看到:
# mysql-sample  mysql  123.57.11.100:3506

# 2. 登录到数据库
tsh db login --database=sample mysql-sample

# 3. 连接数据库 (需要本地安装 mysql 客户端)
tsh db connect mysql-sample

# 这会启动一个本地代理,然后自动连接 mysql
# 等效于: mysql -h 127.0.0.1 -P <local_port> -u sample -p'sample'

# 4. 执行 SQL 测试
tsh db connect mysql-sample
# 在 mysql 提示符下:
SHOW DATABASES;
SELECT VERSION();
EXIT;
```

**使用 Web UI:**

1. 登录 Web UI: https://123.57.11.100:3080
2. 点击左侧 "Databases" 查看数据库列表
3. 点击 "Connect" 获取连接命令

---

## 第六步: 对比旧平台数据

### 6.1 连接旧平台数据库

```bash
# 直接连接 MySQL
mysql -h 123.57.11.100 -P 3506 -u sample -p'sample'

# 查看数据库列表
SHOW DATABASES;

# 切换到旧平台数据库 (根据实际名称修改)
USE old_platform_db;
SHOW TABLES;

# 查看关键数据
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL 7 DAY;
```

### 6.2 连接新平台 (通过 Siriusec 代理)

```bash
# 通过 Siriusec 代理连接
tsh db connect mysql-sample

# 对比相同的数据
USE old_platform_db;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL 7 DAY;
```

### 6.3 数据对比要点

| 对比项 | 检查内容 |
|--------|----------|
| 用户数据 | 用户数量是否一致 |
| 会话记录 | 最近7天的会话数 |
| 审计日志 | 审计记录是否完整 |
| 数据库表 | 表结构是否一致 |
| 数据完整性 | 是否有丢失或重复 |

---

## 故障排除

### Siriusec 启动失败

```bash
# 查看详细错误
siriusec start --config=/etc/siriusec/siriusec.yaml --debug

# 查看日志
tail -f /var/log/siriusec/siriusec.log

# 查看系统日志
journalctl -u siriusec -n 100 --no-pager
```

### 端口被占用

```bash
# 检查端口占用
netstat -tlnp | grep -E '3022|3025|3080|3036'

# 如果被占用,修改配置文件中的端口
```

### 无法访问 Web UI

```bash
# 检查防火墙
iptables -L -n | grep 3080

# 检查 SELinux (如果启用)
getenforce

# 测试本地访问
curl -k https://localhost:3080
```

### 数据库连接失败

```bash
# 测试直连 MySQL
mysql -h 123.57.11.100 -P 3506 -u sample -p'sample' -e "SELECT 1"

# 检查 Siriusec 日志
grep -i "database\|mysql" /var/log/siriusec/siriusec.log
```

---

## 关键端口说明

| 端口 | 用途 | 说明 |
|------|------|------|
| 3022 | SSH 服务 | 本机 SSH 节点监听 |
| 3023 | SSH 代理 | 客户端连接代理 |
| 3025 | Auth 服务 | 集群内部认证 |
| 3036 | MySQL 代理 | 数据库代理监听 |
| 3080 | Web UI | HTTPS Web 界面 |

---

## 完成清单

完成以下任务即表示配置成功:

- [ ] Siriusec 服务正在运行 (`systemctl status siriusec`)
- [ ] 可以访问 Web UI (https://123.57.11.100:3080)
- [ ] 管理员账号已创建并登录
- [ ] 节点列表中能看到本机节点 (`tsh ls`)
- [ ] 可以通过 `tsh ssh` 连接到节点
- [ ] 数据库列表中能看到 mysql-sample (`tsh db ls`)
- [ ] 可以通过 `tsh db connect` 连接数据库
- [ ] 旧平台数据已对比验证

---

## 需要帮助?

如果遇到问题,请提供以下信息:

1. Siriusec 版本: `siriusec version`
2. 服务状态: `systemctl status siriusec`
3. 最近日志: `journalctl -u siriusec -n 50`
4. 具体错误信息
