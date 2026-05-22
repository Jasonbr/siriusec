# Siriusec 前端国际化指南

## 概述

Siriusec 已完成基础国际化(i18n)基础设施搭建,支持中英文切换。

## 已创建的文件

```
web/packages/shared/src/i18n/
├── i18n.js                      # i18next 配置文件
├── LanguageSwitcher.jsx         # 语言切换组件
├── zh/
│   └── common.json              # 中文翻译 (85+ 词条)
└── en/
    └── common.json              # 英文翻译 (85+ 词条)
```

## 快速开始

### 1. 安装依赖

在前端项目中安装必要的包:

```bash
cd web/packages/teleport
npm install i18next react-i18next i18next-browser-languagedetector
```

### 2. 初始化 i18n

在应用入口处初始化:

```javascript
// src/index.js 或 App.js
import '../shared/src/i18n/i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(<App />, document.getElementById('app'));
```

### 3. 使用翻译

在组件中使用 `useTranslation` hook:

```javascript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('dashboard.welcome')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

### 4. 添加语言切换器

```javascript
import LanguageSwitcher from '../shared/src/i18n/LanguageSwitcher';

function Header() {
  return (
    <header>
      <h1>Siriusec</h1>
      <LanguageSwitcher />
    </header>
  );
}
```

## 翻译文件结构

### 命名规范

使用点分命名: `模块.功能`

示例:
- `nav.clusters` - 导航栏的集群
- `login.title` - 登录页面标题
- `common.save` - 通用保存按钮

### 添加新翻译

1. 在 `zh/common.json` 添加中文:
```json
{
  "my.new.key": "我的新翻译"
}
```

2. 在 `en/common.json` 添加英文:
```json
{
  "my.new.key": "My New Translation"
}
```

3. 在代码中使用:
```javascript
t('my.new.key')
```

## 当前翻译覆盖范围

已完成 85+ 核心词条翻译,覆盖:

✅ 导航菜单
✅ 登录页面
✅ 通用按钮和操作
✅ Dashboard
✅ 集群管理
✅ 节点管理
✅ 会话管理
✅ 设置页面
✅ 错误消息

## 扩展翻译

### 按模块拆分

当翻译文件变大时,建议按模块拆分:

```
i18n/
├── zh/
│   ├── common.json
│   ├── dashboard.json
│   ├── clusters.json
│   ├── nodes.json
│   └── ...
└── en/
    ├── common.json
    ├── dashboard.json
    └── ...
```

### 使用提取工具

使用 `i18next-scanner` 自动提取硬编码字符串:

```bash
npm install --save-dev i18next-scanner
npx i18next-scanner --config i18next-scanner.config.js
```

## Web UI 重新构建

修改翻译文件后,重新构建:

```bash
cd web
make build-siriusec

# 复制到 webassets
cp -r dist/* ../webassets/siriusec/
```

## 语言检测

i18n 配置支持多种语言检测方式:

1. URL 参数: `?lng=zh`
2. LocalStorage: `preferred-language`
3. Cookie
4. 浏览器语言设置

## 注意事项

1. **保持一致性**: 确保中英文翻译文件键名完全一致
2. **避免硬编码**: 所有用户可见文本都应使用 `t()` 函数
3. **复数处理**: 使用 i18next 的复数支持
4. **插值**: 使用 `{{variable}}` 语法

## 示例: 带变量的翻译

```json
{
  "nodes.count": "共 {{count}} 个节点"
}
```

```javascript
t('nodes.count', { count: 10 })
// 输出: "共 10 个节点"
```

## 测试

在浏览器中测试语言切换:

1. 打开 Siriusec Web UI
2. 点击语言切换器
3. 选择中文/英文
4. 验证所有文本正确翻译
5. 刷新页面,语言应保持

## 后续改进

- [ ] 添加更多翻译词条
- [ ] 支持更多语言 (日语、韩语等)
- [ ] 实现按需加载翻译文件
- [ ] 添加翻译管理工具
- [ ] 集成翻译 API (如 Google Translate)

## 相关资源

- [i18next 文档](https://www.i18next.com/)
- [react-i18next 文档](https://react.i18next.com/)
- [i18next-scanner](https://github.com/i18next/i18next-scanner)
