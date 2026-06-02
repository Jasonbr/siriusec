#!/bin/bash
# Siriusec 编译和部署脚本 - 在服务器上执行

set -e

export PATH=/usr/local/go/bin:$PATH
export GOPATH=/root/go

echo "======================================"
echo "Siriusec 编译和部署"
echo "======================================"
echo ""

# 1. 清理旧文件
echo "[1/6] 清理旧文件..."
rm -rf /root/go/src/github.com/siriusec/siriusec
rm -f /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh

# 2. 解压源码
echo "[2/6] 解压源码..."
mkdir -p /root/go/src/github.com/siriusec/siriusec
cd /root/go/src/github.com/siriusec/siriusec
tar xzf /tmp/siriusec-src-full.tar.gz
echo "源码已解压, vendor 包数量: $(ls vendor/ 2>/dev/null | wc -l)"

# 3. 创建必要目录
echo "[3/6] 创建目录..."
mkdir -p /var/lib/siriusec
mkdir -p /etc/siriusec
mkdir -p /var/log/siriusec

# 4. 编译
echo "[4/6] 编译二进制文件..."

echo "  - 编译 siriusec (主服务)..."
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
if [ $? -eq 0 ] && [ -f /usr/local/bin/siriusec ]; then
    echo "    成功: $(ls -lh /usr/local/bin/siriusec | awk '{print $5}')"
else
    echo "    失败! 尝试不使用 pam 标签..."
    CGO_ENABLED=1 go build -ldflags '-w -s' -o /usr/local/bin/siriusec ./tool/siriusec
fi

echo "  - 编译 sctl (管理工具)..."
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/sctl ./tool/sctl
if [ $? -eq 0 ] && [ -f /usr/local/bin/sctl ]; then
    echo "    成功: $(ls -lh /usr/local/bin/sctl | awk '{print $5}')"
fi

echo "  - 编译 tsh (客户端)..."
CGO_ENABLED=1 go build -tags "pam" -ldflags '-w -s' -o /usr/local/bin/tsh ./tool/tsh
if [ $? -eq 0 ] && [ -f /usr/local/bin/tsh ]; then
    echo "    成功: $(ls -lh /usr/local/bin/tsh | awk '{print $5}')"
fi

# 5. 设置权限
echo "[5/6] 设置权限..."
chmod +x /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh 2>/dev/null || true

# 6. 创建配置文件
echo "[6/6] 创建配置文件..."

cat > /etc/siriusec/siriusec.yaml <<'YAML'
# Siriusec 配置文件
teleport:
  nodename: node-01
  data_dir: /var/lib/siriusec
  log:
    output: stderr
    severity: INFO
    format:
      output: text

# 认证服务
auth_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3025
  cluster_name: siriusec-cluster
  authentication:
    type: local
    second_factor: "off"

# SSH 服务
ssh_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3022

# 代理服务
proxy_service:
  enabled: "yes"
  listen_addr: 0.0.0.0:3080
  web_listen_addr: 0.0.0.0:3080
  public_addr: 123.57.11.100:3080
YAML

echo ""
echo "======================================"
echo "部署结果"
echo "======================================"
echo ""
echo "二进制文件:"
ls -lh /usr/local/bin/siriusec /usr/local/bin/sctl /usr/local/bin/tsh 2>/dev/null || echo "部分二进制编译失败"
echo ""
echo "配置文件: /etc/siriusec/siriusec.yaml"
echo "数据目录: /var/lib/siriusec"
echo "日志目录: /var/log/siriusec"
echo ""
echo "启动命令:"
echo "  siriusec start --config=/etc/siriusec/siriusec.yaml"
echo ""
echo "Web UI: https://123.57.11.100:3080"
echo "======================================"
