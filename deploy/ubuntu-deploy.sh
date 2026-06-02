#!/bin/bash
#
# Ubuntu 18.04.6 LTS 部署脚本
# 用于在远程服务器上编译和部署 Siriusec 节点包
#

set -e

# 服务器配置
SERVER="123.57.11.100"
PORT="22"
USER="root"
PASSWORD="root@123s"

# MySQL 配置
MYSQL_HOST="123.57.11.100"
MYSQL_PORT="3506"
MYSQL_USER="sample"
MYSQL_PASS="sample"

# Siriusec 配置
SIRIUSEC_VERSION="1.0.0"
SIRIUSEC_HOME="/var/lib/siriusec"
SIRIUSEC_CONFIG="/etc/siriusec"
SIRIUSEC_BIN="/usr/local/bin"

echo "========================================"
echo "Siriusec Ubuntu 18.04.6 LTS 部署脚本"
echo "========================================"

# 检查依赖
echo ""
echo "[1/6] 检查本地依赖..."

if ! command -v ssh &> /dev/null; then
    echo "错误: ssh 命令未找到"
    exit 1
fi

if ! command -v scp &> /dev/null; then
    echo "错误: scp 命令未找到"
    exit 1
fi

if ! command -v sshpass &> /dev/null; then
    echo "警告: sshpass 未安装,将使用交互式 SSH"
    echo "安装命令: brew install sshpass (macOS) 或 apt-get install sshpass (Linux)"
    USE_SSHPASS=false
else
    USE_SSHPASS=true
fi

# 创建部署包
echo ""
echo "[2/6] 创建部署包..."

DEPLOY_DIR=$(mktemp -d)
echo "临时目录: $DEPLOY_DIR"

# 创建目录结构
mkdir -p $DEPLOY_DIR/siriusec-deploy/{bin,config,scripts}

# 复制源码(用于在服务器上编译)
echo "打包源代码..."
tar czf $DEPLOY_DIR/siriusec-deploy/bin/siriusec-src.tar.gz \
    --exclude='.git' \
    --exclude='build' \
    --exclude='vendor' \
    --exclude='frontend' \
    --exclude='*.png' \
    --exclude='*.md' \
    Makefile version.mk \
    api/ \
    tool/ \
    lib/ \
    version.go \
    go.mod \
    go.sum \
    constants.go \
    doc.go \
    2>/dev/null || echo "警告: 部分文件未找到,继续打包可用文件..."

# 创建配置文件
cat > $DEPLOY_DIR/siriusec-deploy/config/siriusec.yaml <<EOF
# Siriusec 节点配置
teleport:
  nodename: node-01
  data_dir: ${SIRIUSEC_HOME}
  log:
    output: stderr
    severity: INFO
    format:
      output: text

# 认证服务配置
auth_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"

# SSH 服务配置
ssh_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3022

# 代理服配置
proxy_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: ${SERVER}:3080
EOF

# 创建安装脚本
cat > $DEPLOY_DIR/siriusec-deploy/scripts/install.sh <<'INSTALL_SCRIPT'
#!/bin/bash
set -e

echo "开始安装 Siriusec..."

# 创建必要的目录
mkdir -p /var/lib/siriusec
mkdir -p /etc/siriusec
mkdir -p /usr/local/bin

# 检查 Go 是否已安装
if ! command -v go &> /dev/null; then
    echo "安装 Go 1.16..."
    GO_VERSION="1.16.15"
    wget -q https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz
    tar -C /usr/local -xzf go${GO_VERSION}.linux-amd64.tar.gz
    rm -f go${GO_VERSION}.linux-amd64.tar.gz

    # 设置环境变量
    echo 'export PATH=/usr/local/go/bin:$PATH' >> /etc/profile.d/go.sh
    echo 'export GOPATH=$HOME/go' >> /etc/profile.d/go.sh
    echo 'export PATH=$GOPATH/bin:$PATH' >> /etc/profile.d/go.sh
    source /etc/profile.d/go.sh
fi

# 编译 Siriusec
echo "编译 Siriusec..."
cd /tmp/siriusec-src

# 下载依赖
go mod vendor 2>/dev/null || true

# 编译
make full || {
    echo "make full 失败,尝试直接编译..."
    CGO_ENABLED=1 go build -tags "webassets_embed" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
    CGO_ENABLED=1 go build -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
    CGO_ENABLED=1 go build -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh
}

# 如果 make 失败,使用预编译二进制
if [ ! -f /usr/local/bin/siriusec ]; then
    echo "使用预编译二进制..."
    cp bin/siriusec /usr/local/bin/ 2>/dev/null || echo "警告: 未找到预编译二进制"
    cp bin/sctl /usr/local/bin/ 2>/dev/null || true
    cp bin/tsh /usr/local/bin/ 2>/dev/null || true
fi

# 设置权限
chmod +x /usr/local/bin/siriusec 2>/dev/null || true
chmod +x /usr/local/bin/sctl 2>/dev/null || true
chmod +x /usr/local/bin/tsh 2>/dev/null || true

# 创建 systemd 服务文件
cat > /etc/systemd/system/siriusec.service <<'EOF'
[Unit]
Description=Siriusec Access Proxy
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

[Install]
WantedBy=multi-user.target
EOF

# 启用服务
systemctl daemon-reload
systemctl enable siriusec.service

echo "Siriusec 安装完成!"
echo "配置文件: /etc/siriusec/siriusec.yaml"
echo "数据目录: /var/lib/siriusec"
echo "启动命令: systemctl start siriusec"
echo "查看状态: systemctl status siriusec"
INSTALL_SCRIPT

chmod +x $DEPLOY_DIR/siriusec-deploy/scripts/install.sh

# 打包
cd $DEPLOY_DIR
tar czf siriusec-deploy-${SIRIUSEC_VERSION}.tar.gz siriusec-deploy/

echo "部署包创建完成: $DEPLOY_DIR/siriusec-deploy-${SIRIUSEC_VERSION}.tar.gz"

# 上传到服务器
echo ""
echo "[3/6] 上传部署包到服务器 ${SERVER}..."

if [ "$USE_SSHPASS" = true ]; then
    sshpass -p "${PASSWORD}" scp -P ${PORT} \
        $DEPLOY_DIR/siriusec-deploy-${SIRIUSEC_VERSION}.tar.gz \
        ${USER}@${SERVER}:/tmp/
else
    echo "请手动上传文件到服务器:"
    echo "scp -P ${PORT} $DEPLOY_DIR/siriusec-deploy-${SIRIUSEC_VERSION}.tar.gz ${USER}@${SERVER}:/tmp/"
    read -p "按回车继续..."
fi

# 在服务器上执行安装
echo ""
echo "[4/6] 在服务器上执行安装..."

if [ "$USE_SSHPASS" = true ]; then
    sshpass -p "${PASSWORD}" ssh -p ${PORT} ${USER}@${SERVER} <<'REMOTE_SCRIPT'
set -e

echo "在服务器上开始安装..."

# 解压
cd /tmp
tar xzf siriusec-deploy-*.tar.gz
cd siriusec-deploy

# 复制配置文件
cp -r config/* /etc/siriusec/ 2>/dev/null || mkdir -p /etc/siriusec && cp -r config/* /etc/siriusec/

# 运行安装脚本
bash scripts/install.sh

# 启动服务
echo ""
echo "[5/6] 启动 Siriusec 服务..."
systemctl start siriusec || /usr/local/bin/siriusec start --config=/etc/siriusec/siriusec.yaml &

# 等待服务启动
sleep 3

# 检查服务状态
echo ""
echo "[6/6] 检查服务状态..."
systemctl status siriusec --no-pager 2>/dev/null || ps aux | grep siriusec | grep -v grep

echo ""
echo "========================================"
echo "部署完成!"
echo "========================================"
echo "Web UI: https://${SERVER}:3080"
echo "SSH 端口: ${SERVER}:3023"
echo "Auth 端口: ${SERVER}:3025"
echo ""
echo "MySQL 数据库连接:"
echo "  主机: ${MYSQL_HOST}"
echo "  端口: ${MYSQL_PORT}"
echo "  账号: ${MYSQL_USER}"
echo "========================================"
REMOTE_SCRIPT
else
    echo "请手动执行以下命令:"
    echo ""
    echo "ssh -p ${PORT} ${USER}@${SERVER}"
    echo "cd /tmp && tar xzf siriusec-deploy-*.tar.gz"
    echo "cd siriusec-deploy"
    echo "cp -r config/* /etc/siriusec/"
    echo "bash scripts/install.sh"
    echo "systemctl start siriusec"
fi

# 清理
echo ""
echo "清理临时文件..."
rm -rf $DEPLOY_DIR

echo ""
echo "部署脚本执行完成!"
