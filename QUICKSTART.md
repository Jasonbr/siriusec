# Siriusec 快速开始指南

## 简介

Siriusec 是一个现代化的基础设施安全访问管理平台,支持 SSH、Kubernetes、数据库和 Web 应用的统一访问控制。

**版本**: 1.0.0  
**语言**: Go  
**许可证**: Apache 2.0

---

## 特性

- 🔐 **零信任架构**: 基于证书的认证,自动过期
- 🌐 **多协议支持**: SSH, Kubernetes, Database (MySQL/PostgreSQL), Web Apps
- 🌍 **国际化**: 完整的中英文支持
- 📊 **审计日志**: 完整的会话录制和回放
- 👥 **RBAC**: 细粒度的基于角色的访问控制
- 🔗 **SSO**: 支持 GitHub, SAML, OIDC 单点登录

---

## 快速安装

### 方式 1: 从源码编译

**前置要求**:
- Go 1.16+
- 1GB+ 内存

```bash
# 克隆仓库
git clone https://github.com/siriusec/siriusec.git
cd siriusec

# 编译
make full

# 二进制文件位于 ./build/
./build/siriusec version
./build/sctl version
./build/tsh version
```

### 方式 2: 使用 Docker

```bash
# 拉取镜像
docker pull registry.siriusec.com/siriusec:1.0.0

# 运行单节点集群
docker run -d --name siriusec \
  -p 3023:3023 \
  -p 3024:3024 \
  -p 3025:3025 \
  -p 3080:3080 \
  registry.siriusec.com/siriusec:1.0.0
```

---

## 单节点部署

### 1. 创建数据目录

```bash
sudo mkdir -p -m0700 /var/lib/siriusec
sudo chown $USER /var/lib/siriusec
```

### 2. 启动 Siriusec

```bash
# 开发模式
DEBUG=1 ./build/siriusec start -d

# 生产模式
sudo ./build/siriusec start
```

### 3. 访问 Web UI

打开浏览器访问: `https://localhost:3080`

**创建管理员账户**:
1. 首次访问会提示创建管理员
2. 设置用户名和密码
3. 下载登录凭证

---

## 使用 CLI

### 登录

```bash
# 使用用户名密码登录
./build/tsh login --proxy=localhost:3080 --user=admin

# 使用 SSO 登录
./build/tsh login --proxy=localhost:3080 --auth=github
```

### 查看节点

```bash
./build/tsh ls
```

### SSH 连接

```bash
# 连接到节点
./build/tsh ssh user@node-name

# 直接执行命令
./build/tsh ssh user@node-name "ls -la"
```

### 管理集群

```bash
# 查看集群状态
./build/sctl status

# 查看用户
./build/sctl users list

# 创建角色
./build/sctl create -f role.yaml
```

---

## 国际化使用

### Web UI 语言切换

1. 登录 Web UI
2. 点击右上角设置图标
3. 选择语言: 中文 / English
4. 语言偏好会自动保存

### 翻译扩展

如需添加更多翻译,编辑:

```
web/packages/shared/src/i18n/
├── zh/common.json    # 中文
└── en/common.json    # 英文
```

添加新的键值对:
```json
{
  "my.new.key": "我的翻译"
}
```

在代码中使用:
```javascript
const { t } = useTranslation();
t('my.new.key')
```

详见: `web/packages/shared/src/i18n/README.md`

---

## 配置示例

### 基本配置 (siriusec.yaml)

```yaml
siriusec:
  cluster_name: "my-cluster"
  
  auth_service:
    enabled: "yes"
    listen_addr: "0.0.0.0:3025"
    
  proxy_service:
    enabled: "yes"
    listen_addr: "0.0.0.0:3023"
    web_listen_addr: "0.0.0.0:3080"
    public_addr: "siriusec.example.com:443"
    
  ssh_service:
    enabled: "yes"
    listen_addr: "0.0.0.0:3022"
    labels:
      env: "production"
      team: "devops"
```

### 启动自定义配置

```bash
./build/siriusec start --config=/etc/siriusec/siriusec.yaml
```

---

## Kubernetes 集成

### 1. 启用 Kubernetes 代理

```yaml
siriusec:
  proxy_service:
    kube_listen_addr: "0.0.0.0:3026"
    kube_public_addr: "kube.example.com:443"
```

### 2. 配置 kubectl

```bash
# 登录并获取 kube credentials
./build/tsh login --proxy=localhost:3080
./build/tsh kube login cluster-name

# 使用 kubectl
kubectl get nodes
```

---

## 数据库代理

### 1. 配置数据库

```yaml
siriusec:
  db_service:
    enabled: "yes"
    databases:
    - name: "postgres-production"
      protocol: "postgres"
      uri: "postgres.example.com:5432"
      labels:
        env: "production"
```

### 2. 连接数据库

```bash
# 查看可用数据库
./build/tsh db ls

# 登录数据库
./build/tsh db login postgres-production

# 连接
./build/tsh db connect postgres-production
```

---

## Web 应用代理

### 1. 注册应用

```yaml
siriusec:
  app_service:
    enabled: "yes"
    apps:
    - name: "grafana"
      uri: "http://grafana.internal:3000"
      public_addr: "grafana.example.com"
```

### 2. 访问应用

通过 Siriusec 代理访问: `https://grafana.example.com`

---

## 访问控制

### 创建角色

```yaml
# role.yaml
kind: role
metadata:
  name: developer
spec:
  allow:
    logins: [ubuntu, ec2-user]
    node_labels:
      env: production
    rules:
    - resources: [node]
      verbs: [read, list]
```

```bash
./build/sctl create -f role.yaml
```

### 创建用户

```bash
./build/sctl users add john --roles=developer --logins=john
```

---

## 审计和会话

### 查看审计日志

```bash
# Web UI: 审计日志页面
# 或使用 API
curl -H "Authorization: Bearer $TOKEN" \
  https://localhost:3080/v1/events
```

### 会话回放

```bash
# 列出会话
./build/tsh play --list

# 回放会话
./build/tsh play session-id
```

---

## 故障排查

### 调试模式

```bash
DEBUG=1 ./build/siriusec start -d
```

### 查看日志

```bash
# 日志位置
/var/lib/siriusec/log/

# 或使用 journalctl
sudo journalctl -u siriusec -f
```

### 常见问题

**Q: 无法连接 Web UI**  
A: 检查防火墙,确保 3080 端口开放

**Q: 登录失败**  
A: 确认认证服务正常运行: `./build/sctl status`

**Q: SSH 连接超时**  
A: 检查节点标签和角色权限

---

## 文档和资源

- 📖 **完整文档**: https://siriusec.com/docs
- 💬 **论坛**: https://github.com/siriusec/siriusec/discussions
- 🐛 **问题反馈**: https://github.com/siriusec/siriusec/issues
- 📝 **博客**: https://siriusec.com/blog

---

## 下一步

1. ✅ 完成快速开始
2. 📚 阅读[管理员指南](https://siriusec.com/docs/admin-guide)
3. 🔧 配置 SSO 集成
4. 🌐 设置多集群信任
5. 📊 配置审计和告警

---

**祝您使用愉快!** 🚀
