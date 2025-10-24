# MomentTabManager 项目熟悉指南

## 📋 项目概述

**MomentTabManager** 是一个功能强大的 Chrome 浏览器扩展程序（Manifest V3），提供三大核心功能模块：

1. **标签管理** - 智能分组、去重、复制标签页
2. **链接预览** - 悬停/点击预览链接内容，支持文本拖拽搜索/翻译
3. **窗口管理** - 多窗口布局展示，网格系统管理

**版本**: 0.1.1 | **技术栈**: Vanilla JavaScript + Chrome Extension APIs

---

## 🏗️ 核心架构

### 文件结构
```
├── manifest.json                 # 扩展配置（Manifest V3）
├── background.js                 # Service Worker（后台脚本）
├── sidepanel.html               # 侧边栏UI（标签管理+链接预览+窗口管理）
├── window-manager.html          # 窗口管理专用页面
│
├── content-scripts/             # 内容脚本（在网页中运行）
│   ├── global-shortcuts.js      # 快捷键监听和分发
│   ├── link-preview.js          # 链接预览核心逻辑（3170行）
│   └── text-drag-config.js      # 文本拖拽配置
│
├── js/                          # 业务逻辑模块
│   ├── tab-manager.js           # 标签管理核心类
│   ├── window-manager.js        # 窗口管理核心类
│   ├── sidepanel.js             # 侧边栏交互逻辑
│   ├── utils.js                 # 工具函数（域名处理、快捷键解析等）
│   └── interact.min.js          # 拖拽库
│
├── css/                         # 样式文件
│   ├── sidepanel.css
│   ├── link-preview.css
│   └── window-manager.css
│
├── rules/                       # 声明式网络请求规则
│   └── iframe-rules.json        # 移除X-Frame-Options和CSP头
│
└── dist/                        # 构建输出目录
```

---

## 🔄 通信流程

### 消息传递架构
```
用户操作 (网页)
    ↓
Content Script (global-shortcuts.js)
    ↓ chrome.runtime.sendMessage()
Background Service Worker (background.js)
    ↓ 处理消息，调用TabManager/WindowManager
    ↓ chrome.tabs.sendMessage()
Content Script (link-preview.js)
    ↓
UI更新 (侧边栏/预览窗口)
```

### 关键消息类型
- `groupTabs` - 分组标签页
- `deduplicateTabs` - 去重标签页
- `copyCurrentTab` / `copyAllTabs` - 复制标签
- `getSettings` / `updateSettings` - 设置管理
- `createCrossTabPreview` - 跨标签页预览
- `shortcutsUpdated` - 快捷键更新通知

---

## 🎯 三大功能模块详解

### 1️⃣ 标签管理模块 (tab-manager.js)

**核心类**: `TabManager`

**主要方法**:
- `groupTabsByDomain()` - 按域名分组标签页
- `deduplicateTabs()` - 删除重复标签页
- `copyCurrentTab()` - 复制当前标签URL和标题
- `copyAllTabs()` - 复制所有标签URL和标题
- `ungroupAllTabs()` - 取消所有分组

**特性**:
- 防重复触发机制（100ms冷却时间）
- 统一错误处理包装器
- Chrome API可用性检查

---

### 2️⃣ 链接预览模块 (link-preview.js)

**核心类**: `LinkWindowManager`

**功能**:
- 链接悬停/点击预览
- 文本拖拽搜索/翻译
- 跨标签页窗口管理
- 加载指示器管理
- 焦点管理

**特性**:
- 支持多个预览窗口同时打开
- 自定义窗口大小、位置、颜色、透明度
- 支持多搜索引擎和翻译引擎
- 使用declarativeNetRequest移除iframe限制

---

### 3️⃣ 窗口管理模块 (window-manager.js)

**核心类**: `WindowManager`

**功能**:
- 6×4网格系统布局
- 拖拽创建和调整窗口
- 标签页到窗口的映射
- 实时渲染和交互

**特性**:
- 自动位置冲突检测
- 网格对齐
- 批量DOM操作优化
- requestAnimationFrame渲染优化

---

## ⚙️ 快捷键系统

### 默认快捷键
```
Ctrl+M              - 分组标签
Ctrl+Shift+M        - 去重标签
Ctrl+K              - 复制标签
Ctrl+Shift+K        - 取消分组
Ctrl+Shift+Q        - 打开窗口管理
```

### 快捷键流程
1. 用户按下快捷键
2. `global-shortcuts.js` 监听并解析
3. 发送消息到 `background.js`
4. 调用对应的 `TabManager` 方法
5. 返回结果到侧边栏

---

## 💾 存储管理

### 存储键值
- `linkWindowSettings` - 链接预览设置
- `moment-tab-shortcuts` - 用户自定义快捷键
- `windowManagerConfig` - 窗口管理配置

### 存储方式
使用 `chrome.storage.local` API，支持实时同步和变化监听

---

## 🔐 权限声明

```json
"permissions": [
  "storage",              // 本地存储
  "tabs",                 // 标签页操作
  "tabGroups",            // 标签分组
  "activeTab",            // 活跃标签
  "scripting",            // 脚本注入
  "clipboardWrite",       // 剪贴板写入
  "sidePanel",            // 侧边栏
  "declarativeNetRequest" // 网络请求修改
]
```

---

## 🚀 开发工作流

### 本地开发
1. 修改源文件
2. Chrome扩展页面刷新扩展
3. 测试功能

### 构建发布
```bash
npm run build  # 或 node build.js
```
生成 `dist/` 目录和 `momenttabmanager-v*.zip` 包

### 关键开发工具
- `build.js` - 自动化构建脚本
- `manifest.json` - 扩展配置
- Chrome DevTools - 调试工具

---

## 📊 代码统计

| 文件 | 行数 | 功能 |
|------|------|------|
| link-preview.js | 3170 | 链接预览核心 |
| background.js | 1311 | 后台服务 |
| window-manager.js | 800+ | 窗口管理 |
| tab-manager.js | 382 | 标签管理 |
| sidepanel.js | 600+ | 侧边栏交互 |

---

## 🔍 关键概念

### 跨标签页通信
- 使用 `chrome.runtime.sendMessage()` 和 `chrome.tabs.sendMessage()`
- Background脚本作为消息中枢
- Content scripts在各标签页中运行

### 声明式网络请求
- `rules/iframe-rules.json` 移除 `X-Frame-Options` 和 `Content-Security-Policy` 头
- 允许任何网站在iframe中显示
- 支持95%以上的网站

### 防重复触发
- 使用 `actionCooldowns` Map记录最后执行时间
- 100ms内重复触发被忽略
- 防止用户快速重复点击导致的问题

---

## 📝 下一步开发建议

1. **功能扩展** - 添加更多标签管理功能
2. **性能优化** - 优化大量标签页的处理
3. **UI改进** - 增强用户界面和交互体验
4. **测试覆盖** - 添加单元测试和集成测试
5. **文档完善** - 补充API文档和使用指南

---

**最后更新**: 2025-10-24
**项目地址**: https://github.com/moment-team/tab-manager

