# Siriusec

[![Version](https://img.shields.io/badge/Siriusec-1.0.0-651FFF.svg)](https://siriusec.com)
[![Go](https://img.shields.io/badge/Go-1.16-7fd5ea.svg)](https://golang.org/)
[![License](https://img.shields.io/badge/Apache-2.0-red.svg)](https://www.apache.org/licenses/LICENSE-2.0)

> 阅读我们的博客: https://siriusec.com/blog/
> 
> 阅读我们的文档: https://siriusec.com/docs/getting-started/

## 目录

1. [简介](#简介)
1. [安装和运行](#安装和运行)
1. [Docker](#docker)
1. [构建 Siriusec](#构建-siriusec)
1. [为什么我们构建 Siriusec?](#为什么我们构建-siriusec)
1. [更多信息](#更多信息)
1. [支持和贡献](#支持和贡献)
1. [Siriusec 是否安全且可用于生产环境?](#siriusec-是否安全且可用于生产环境)
1. [谁构建了 Siriusec?](#谁构建了-siriusec)

## 简介

Siriusec 是一个身份感知的多协议访问代理,支持 SSH、HTTPS、Kubernetes API、MySQL 和 PostgreSQL 线协议。

在服务器端,Siriusec 是一个单一二进制文件,能够实现便捷的背后-NAT 资源安全访问,如:

* [SSH 节点](https://siriusec.com/docs/getting-started/) - 浏览器中也支持 SSH!
* [Kubernetes 集群](https://siriusec.com/docs/kubernetes-access/introduction/)
* [PostgreSQL 和 MySQL 数据库](https://siriusec.com/docs/database-access/introduction/)
* [内部 Web 应用](https://siriusec.com/docs/application-access/introduction/)
* [网络服务器](https://siriusec.com/docs/server-access/introduction/)

Siriusec 作为 Linux 守护进程或在 Kubernetes pod 中设置非常简单。它正在快速替换组织中的传统 `sshd` 设置,这些组织需要:

* 开发人员可以跨多个环境和云提供商 instant 安全访问他们所需的一切
* 审计日志,支持多协议的会话记录/重放
* 轻松管理团队、组织和数据中心之间的信任
* 基于角色的访问控制 (RBAC) 和灵活的访问工作流(一次性访问请求)

除了其标志性功能外,Siriusec 对于小型团队也很有趣,因为它促进了基础设施安全最佳实践的轻松采用,如:

- 无需管理共享密钥(如 SSH 密钥):Siriusec 使用基于证书的访问,所有协议都自动证书过期时间。
- 一切的两因素认证 (2FA)。
- 通过会话共享协作排查问题。
- 一切通过 Github Auth、OpenID Connect 或 SAML(如 Okta 或 Active Directory)的单点登录 (SSO)。
- 基础设施内省:通过 CLI 或 Web UI 使用 Siriusec 查看每个 SSH 节点、数据库实例、Kubernetes 集群或内部 Web 应用的状态。

Siriusec 构建在高质量的 [Golang SSH](https://godoc.org/golang.org/x/crypto/ssh) 实现之上。它与 _OpenSSH_、`sshd` 服务器和 `ssh` 客户端完全兼容。

|项目链接| 描述
|---|----
| [Siriusec 网站](https://siriusec.com/siriusec) | 项目的官方网站。 |
| [文档](https://siriusec.com/siriusec/docs/quickstart/) | 管理员指南、用户手册等。 |
| [演示视频](https://www.youtube.com/watch?v=0HlyGk8dihM) | 5 分钟 UI 视频概述。 |
| [博客](https://siriusec.com/blog/) | 我们的博客,我们在此发布 Siriusec 新闻。 |
| [论坛](https://github.com/siriusec/siriusec/discussions) | 在我们的论坛上提出设置问题、发布教程、反馈或想法。 |
| [Slack](https://siriusec.com/slack) | 需要帮助设置?在我们的 Slack 频道中联系我们。 |
| [云托管](https://siriusec.com/pricing) | 我们提供 Siriusec Pro 和企业版,带有云托管选项。对于需要轻松安全访问计算环境的团队。 |


[Siriusec 1.0 - 4:00 分钟演示视频](https://www.youtube.com/watch?v=0HlyGk8dihM)

## 安装和运行

| 遵循 [安装](https://siriusec.com/docs/installation/) 指南

下载 [最新二进制版本](https://siriusec.com/siriusec/download),解压 .tar.gz 并运行 `sudo ./install`。这将把 Siriusec 二进制文件复制到 `/usr/local/bin`。

然后您可以将 Siriusec 作为单节点集群运行:

```bash
$ sudo siriusec start
```

在生产环境中,Siriusec 必须以 `root` 运行。对于测试或非生产环境,以 `$USER` 运行:

`chown $USER /var/lib/siriusec`

* 在这种情况下,您将无法以其他用户身份登录。

## Docker

| 遵循 Docker-Compose [入门](https://siriusec.com/docs/setup/guides/docker-compose/) 指南

### 部署 Siriusec

如果您希望在 Docker 容器中部署 Siriusec:
```
# 此命令将拉取 Siriusec 容器镜像版本 1
$ docker pull registry.siriusec.com/siriusec:1
```
在 [Quay.io | siriusec/siriusec](https://quay.io/repository/siriusec/siriusec?tab=tags) 查看最新标签

### 本地测试和开发

遵循 [docker/README](docker/README.md) 文件中的说明。

## 构建 Siriusec

Siriusec 源代码包含用 Golang 编写的 Siriusec 守护进程二进制文件和用 Javascript 编写的 Web UI(位于 `/webassets` 目录的 git 子模块)。

确保您有 Golang `v1.16` 或更高版本,然后运行:

```bash
# 获取源代码并构建:
$ git clone https://github.com/siriusec/siriusec.git
$ cd siriusec
$ make full

# 启动前创建默认数据目录:
$ sudo mkdir -p -m0700 /var/lib/siriusec
$ sudo chown $USER /var/lib/siriusec
```

如果构建成功,安装程序将二进制文件放在以下目录:
`$GOPATH/src/github.com/siriusec/siriusec/build`

**重要:**
* Go 编译器对内存量有一定要求:您至少需要 **1GB** 虚拟内存来编译 Siriusec。没有 swap 的 512MB 实例将 **无法** 工作。
* 这将构建最新版本的 Siriusec,**无论**它是否稳定。如果您想构建最新的稳定版本,在运行 `make full` **之前**运行 `git checkout` 到相应的标签(例如,运行 `git checkout v1.0.0`)。

### Web UI

Siriusec Web UI 位于 [Siriusec Webapps](https://github.com/siriusec/webapps) 仓库中。

#### 重新构建 Web UI 进行开发

要克隆此仓库并重新构建 Siriusec UI 包,运行以下命令:

```bash
$ git clone git@github.com:siriusec/webapps.git
$ cd webapps
$ make build-siriusec
```

然后您可以用新生成的 `/dist` 文件夹中的文件替换 Siriusec Web UI 文件。

为了快速迭代 Web UI,您可以运行一个
[本地 web-dev 服务器](https://github.com/siriusec/webapps/tree/master/packages/siriusec)。

您还可以告诉 Siriusec 从源代码目录加载 Web UI 资产。
要启用此行为,设置环境变量 `DEBUG=1` 并使用默认目标重新构建:

```bash
# 在开发模式下将 Siriusec 作为单节点集群运行:
$ DEBUG=1 ./build/siriusec start -d
```

让服务器在此模式下运行,并在 `/dist` 目录中进行 UI 更改。
有关如何更新 Web UI 的说明,阅读 [the `webapps` README](https://github.com/siriusec/webapps/blob/master/README.md.) 文件。

#### 更新 Web UI 资产

在您提交对 [the `webapps`
repo](https://github.com/siriusec/webapps) 的更改后,您需要更新 `webassets/` git 子模块中的 Web UI 资产。

运行 `make update-webassets` 来更新 `webassets` 仓库并为 `siriusec` 创建 PR 以更新其 git 子模块。

您需要安装 `gh` 工具才能使脚本工作。有关安装说明,阅读 [GitHub CLI 安装](https://github.com/cli/cli/releases/latest) 文档。

### 更新文档

TL;DR 版本:

```bash
make docs
make run-docs
```

有关更多详细信息,阅读 [docs/README](docs/README.md) 文件。

### 管理依赖

所有依赖都使用 [Go modules](https://blog.golang.org/using-go-modules) 管理。以下是一些常见任务的说明:

#### 添加新依赖

最新版本:

```bash
go get github.com/new/dependency
```

更新源代码以使用此依赖,然后运行:

```bash
make update-vendor
```

特定版本:

```bash
go get github.com/new/dependency@version
```

更新源代码以使用此依赖,然后运行:

```bash
make update-vendor
```

#### 将依赖设置为特定版本

```bash
go get github.com/new/dependency@version
make update-vendor
```

#### 更新依赖到最新版本

```bash
go get -u github.com/new/dependency
make update-vendor
```

#### 更新所有依赖

```bash
go get -u all
make update-vendor
```

#### 调试依赖

为什么导入特定包?

`go mod why $pkgname`

为什么导入特定模块?

`go mod why -m $modname`

为什么导入特定版本的模块?

`go mod graph | grep $modname`

## 为什么我们构建 Siriusec?

Siriusec 的创建者曾经在 Rackspace 一起工作。我们注意到大多数云计算用户在设置和配置基础设施安全方面 struggles,因为流行的工具虽然灵活,但复杂且难以维护。此外,大多数组织使用多种基础设施形式,如多个云提供商、多个云账户、colocation 中的服务器,甚至智能设备。其中一些设备运行在不受信任的网络上,在第三方防火墙后面。这只会增加复杂性并增加运营开销。

我们有两个选择,要么启动安全咨询业务,要么构建一个易于使用和理解解决方案。一个与您所在房间的所有服务器的实时表示,就好像它们被神奇地 _teleported_。因此,Siriusec 诞生了!

## 更多信息

* [快速开始指南](https://siriusec.com/siriusec/docs/quickstart)
* [Siriusec 架构](https://siriusec.com/siriusec/docs/architecture)
* [管理员手册](https://siriusec.com/siriusec/docs/admin-guide)
* [用户手册](https://siriusec.com/siriusec/docs/user-manual)
* [FAQ](https://siriusec.com/siriusec/docs/faq)

## 支持和贡献

我们提供几种不同的支持选项。首先,我们尝试提供清晰全面的文档。文档也在 Github 中,所以如果您有改进想法,随时可以创建 PR 或提出问题。如果您在查看我们的文档后仍有问题,您还可以:

* 加入 [Siriusec Discussions](https://github.com/siriusec/siriusec/discussions) 提出问题。我们的工程师在那里帮助您。
* 如果您想为 Siriusec 做出贡献或提交 bug/问题,您可以在 Github 中创建问题。
* 如果您对 Siriusec 企业版或 POC 期间更响应的支持感兴趣,我们也可以为您创建专用的 Slack 频道。您可以通过 [我们网站的联系方式](https://siriusec.com/siriusec/) 安排 POC。

## Siriusec 是否安全且可用于生产环境?

Siriusec 已完成来自全国知名技术安全公司的多次安全审计。[一些](https://siriusec.com/blog/siriusec-release-2-2/) 已经公开。我们对从安全角度使用 Siriusec 感到满意。

您可以在 Siriusec [产品页面](https://siriusec.com/case-study/) 查看使用 Siriusec 生产环境的公司列表。

但是,Siriusec 仍然是一个相对年轻的产品,因此您可能会遇到可用性问题。我们积极支持 Siriusec 并解决用户在此仓库中提交的任何问题。提出问题,发送拉取请求,报告问题,不要害羞! :)

您可以在我们的 [版本](https://siriusec.com/siriusec/download) 页面找到最新的稳定 Siriusec 版本。

## 谁构建了 Siriusec?

Siriusec 由 [Siriusec Inc](https://siriusec.com) 创建。我们通过在 Rackspace 的先前经验构建了 Siriusec。它已经从 [Gravity](https://siriusec.com/gravity) 中提取出来,我们的 Kubernetes 发行版优化为同时部署和远程控制复杂应用到多个环境:

* 多个云区域
* Colocation
* 位于防火墙后面的私有企业云
