#!/bin/bash
# ==========================================
# Siriusec 节点和数据库一键配置脚本
# ==========================================
# 用途: 添加主机节点和 MySQL 数据库到 Siriusec
# ==========================================

set -e

echo "=========================================="
echo "Siriusec 节点和数据库配置"
echo "=========================================="
echo ""

# 服务器配置
SERVER_IP="123.57.11.100"
MYSQL_HOST="123.57.11.100"
MYSQL_PORT="3506"
MYSQL_USER="sample"
MYSQL_PASS="sample"

# Siriusec 配置
SIRIUSEC_HOME="/var/lib/siriusec"
SIRIUSEC_CONFIG="/etc/siriusec"
SIRIUSEC_LOG="/var/log/siriusec"
SIRIUSEC_BIN="/usr/local/bin"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==========================================
# 步骤 1: 检查前置条件
# ==========================================
echo ""
echo "[步骤 1/8] 检查前置条件..."

# 检查 siriusec 二进制
if [ ! -f "${SIRIUSEC_BIN}/siriusec" ]; then
    echo_error "siriusec 未安装!"
    echo_info "请先运行编译脚本: bash /tmp/build-on-server.sh"
    exit 1
fi

echo_info "siriusec 已安装: $(ls -lh ${SIRIUSEC_BIN}/siriusec | awk '{print $5}')"

# 检查 MySQL 连接
echo_info "测试 MySQL 连接..."
if command -v mysql >/dev/null 2>&1; then
    if MYSQL_PWD="${MYSQL_PASS}" mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" -e "SELECT 1" >/dev/null 2>&1; then
        echo_info "MySQL 连接成功!"

        # 获取数据库列表
        echo ""
        echo_info "MySQL 数据库列表:"
        MYSQL_PWD="${MYSQL_PASS}" mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" -e "SHOW DATABASES;" 2>/dev/null | grep -v -E "(Database|information_schema|mysql|performance_schema|sys)"
    else
        echo_warn "MySQL 连接失败,但继续配置"
        echo_info "请检查: mysql -h ${MYSQL_HOST} -P ${MYSQL_PORT} -u ${MYSQL_USER} -p'${MYSQL_PASS}'"
    fi
else
    echo_warn "mysql 客户端未安装,跳过连接测试"
    echo_info "安装命令: apt-get install -y mysql-client"
fi

# ==========================================
# 步骤 2: 创建目录结构
# ==========================================
echo ""
echo "[步骤 2/8] 创建目录结构..."

mkdir -p ${SIRIUSEC_HOME}
mkdir -p ${SIRIUSEC_CONFIG}
mkdir -p ${SIRIUSEC_LOG}
mkdir -p ${SIRIUSEC_CONFIG}/tls
mkdir -p ${SIRIUSEC_CONFIG}/certs

echo_info "目录创建完成:"
echo "  数据目录: ${SIRIUSEC_HOME}"
echo "  配置目录: ${SIRIUSEC_CONFIG}"
echo "  日志目录: ${SIRIUSEC_LOG}"

# ==========================================
# 步骤 3: 生成自签名 TLS 证书
# ==========================================
echo ""
echo "[步骤 3/8] 生成 TLS 证书..."

if [ ! -f "${SIRIUSEC_CONFIG}/tls/server.crt" ]; then
    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout ${SIRIUSEC_CONFIG}/tls/server.key \
        -out ${SIRIUSEC_CONFIG}/tls/server.crt \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Siriusec/CN=${SERVER_IP}" \
        -addext "subjectAltName=IP:${SERVER_IP}" 2>/dev/null

    echo_info "TLS 证书已生成: ${SIRIUSEC_CONFIG}/tls/server.crt"
else
    echo_info "TLS 证书已存在"
fi

# ==========================================
# 步骤 4: 创建主机节点配置
# ==========================================
echo ""
echo "[步骤 4/8] 创建主机节点配置..."

cat > ${SIRIUSEC_CONFIG}/node.yaml << EOF
# Siriusec 主机节点配置
teleport:
  nodename: ubuntu-$(hostname)
  advertise_ip: 0.0.0.0
  data_dir: ${SIRIUSEC_HOME}
  log:
    output: ${SIRIUSEC_LOG}/siriusec.log
    severity: INFO
    format:
      output: text

# SSH 服务
ssh_service:
  enabled: yes
  listen_addr: 0.0.0.0:3022
  labels:
    env: production
    os: ubuntu
    version: "18.04"
    role: node
    hostname: $(hostname)
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

# Proxy 服务
proxy_service:
  enabled: yes
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: ${SERVER_IP}:3080
  ssh_public_addr: ${SERVER_IP}:3023
  mysql_listen_addr: 0.0.0.0:3036
  mysql_public_addr: ${SERVER_IP}:3036
  https_key_file: ${SIRIUSEC_CONFIG}/tls/server.key
  https_cert_file: ${SIRIUSEC_CONFIG}/tls/server.crt
EOF

echo_info "主机节点配置已创建: ${SIRIUSEC_CONFIG}/node.yaml"

# ==========================================
# 步骤 5: 创建数据库配置
# ==========================================
echo ""
echo "[步骤 5/8] 创建数据库配置..."

cat > ${SIRIUSEC_CONFIG}/database.yaml << EOF
# Siriusec 数据库配置
# 此文件包含数据库代理配置

db_service:
  enabled: yes
  databases:
    # MySQL 示例数据库
    - name: mysql-sample
      description: "Sample MySQL Database"
      protocol: mysql
      uri: ${MYSQL_HOST}:${MYSQL_PORT}
      static_labels:
        env: production
        type: mysql
        team: sample
EOF

echo_info "数据库配置已创建: ${SIRIUSEC_CONFIG}/database.yaml"

# ==========================================
# 步骤 6: 创建完整配置 (包含节点+数据库)
# ==========================================
echo ""
echo "[步骤 6/8] 创建完整配置..."

cat > ${SIRIUSEC_CONFIG}/siriusec.yaml << EOF
# ==========================================
# Siriusec 完整配置
# 包含: 主机节点 + 数据库代理
# ==========================================

# 全局配置
teleport:
  nodename: siriusec-$(hostname)
  data_dir: ${SIRIUSEC_HOME}
  log:
    output: ${SIRIUSEC_LOG}/siriusec.log
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

# SSH 服务 (主机节点)
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
  public_addr: ${SERVER_IP}:3080
  ssh_public_addr: ${SERVER_IP}:3023
  mysql_listen_addr: 0.0.0.0:3036
  mysql_public_addr: ${SERVER_IP}:3036
  https_key_file: ${SIRIUSEC_CONFIG}/tls/server.key
  https_cert_file: ${SIRIUSEC_CONFIG}/tls/server.crt

# 数据库服务
db_service:
  enabled: yes
  databases:
    - name: mysql-sample
      description: "Sample MySQL Database on ${MYSQL_HOST}:${MYSQL_PORT}"
      protocol: mysql
      uri: ${MYSQL_HOST}:${MYSQL_PORT}
      static_labels:
        env: production
        type: mysql
        team: sample
EOF

echo_info "完整配置已创建: ${SIRIUSEC_CONFIG}/siriusec.yaml"

# ==========================================
# 步骤 7: 创建 systemd 服务文件
# ==========================================
echo ""
echo "[步骤 7/8] 创建 systemd 服务..."

cat > /etc/systemd/system/siriusec.service << 'EOF'
[Unit]
Description=Siriusec Access Proxy - Node and Database
Documentation=https://siriusec.com/docs/
After=network.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/usr/local/bin/siriusec start --config=/etc/siriusec/siriusec.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable siriusec.service

echo_info "systemd 服务已创建并启用"

# ==========================================
# 步骤 8: 启动服务
# ==========================================
echo ""
echo "[步骤 8/8] 启动 Siriusec 服务..."

# 停止可能正在运行的实例
systemctl stop siriusec 2>/dev/null || true
sleep 2

# 启动服务
systemctl start siriusec
sleep 3

# 检查状态
echo ""
echo "=========================================="
echo "服务状态"
echo "=========================================="

if systemctl is-active --quiet siriusec; then
    echo_info "Siriusec 服务正在运行!"
    echo ""
    systemctl status siriusec --no-pager | head -15
else
    echo_error "Siriusec 服务启动失败"
    echo ""
    echo_info "查看详细日志:"
    journalctl -u siriusec -n 50 --no-pager
    echo ""
    echo_info "尝试手动启动:"
    echo "  ${SIRIUSEC_BIN}/siriusec start --config=${SIRIUSEC_CONFIG}/siriusec.yaml"
fi

# ==========================================
# 显示配置摘要
# ==========================================
echo ""
echo "=========================================="
echo "配置摘要"
echo "=========================================="
echo ""
echo "主机节点:"
echo "  节点名称: siriusec-$(hostname)"
echo "  SSH 端口: ${SERVER_IP}:3022"
echo "  Web UI:   https://${SERVER_IP}:3080"
echo ""
echo "数据库代理:"
echo "  数据库名称: mysql-sample"
echo "  协议: MySQL"
echo "  实际地址: ${MYSQL_HOST}:${MYSQL_PORT}"
echo "  代理地址: ${SERVER_IP}:3036"
echo ""
echo "配置文件:"
echo "  主配置: ${SIRIUSEC_CONFIG}/siriusec.yaml"
echo "  节点配置: ${SIRIUSEC_CONFIG}/node.yaml"
echo "  数据库配置: ${SIRIUSEC_CONFIG}/database.yaml"
echo ""
echo "日志文件:"
echo "  应用日志: ${SIRIUSEC_LOG}/siriusec.log"
echo "  系统日志: journalctl -u siriusec"
echo ""
echo "=========================================="
echo "下一步操作"
echo "=========================================="
echo ""
echo "1. 创建管理员用户:"
echo "   sctl users add admin --roles=editor,access --logins=root"
echo ""
echo "2. 测试 SSH 访问:"
echo "   tsh --proxy=${SERVER_IP}:3080 login"
echo "   tsh ls"
echo "   tsh ssh root@$(hostname)"
echo ""
echo "3. 测试数据库访问:"
echo "   tsh db ls"
echo "   tsh db connect --database=sample mysql-sample"
echo ""
echo "=========================================="
