# 文本拖拽功能升级 - 开发实现指南

**文档版本**: 1.0  
**创建时间**: 2025-10-24  
**项目**: MomentTabManager  
**功能**: 文本拖拽搜索平台升级  
**难度**: 中等  
**预计工时**: 36-46 小时

---

## 📋 项目概述

### 需求背景
升级文本拖拽功能，实现用户自定义搜索平台配置，支持每个拖拽方向配置多个平台，在拖拽过程中实时显示平台列表供用户选择。

### 核心改进
- **当前**: mousedown → mousemove → mouseup → 计算方向 → 执行单一操作
- **目标**: mousedown → mousemove(>=20px) → 显示平台列表 → 用户选择 → mouseup → 执行选中平台操作

### 技术亮点
- requestAnimationFrame 节流保持 60fps
- CSS transform GPU加速
- DOM 缓存复用
- 多层防护机制
- 向后兼容原有功能

---

## 🎯 完整 TODO 列表

### 第一阶段: 准备工作 (2-3 小时)

#### 1.1 数据结构设计
- [ ] **1.1.1** 设计新的配置数据结构
  - 预设平台配置 (Google, DeepSeek, Wikipedia, Baidu等)
  - 自定义平台配置字段
  - 方向配置支持多平台
  - 参考文件: `background.js` 第95-142行
  - 输出: 新配置结构文档

- [ ] **1.1.2** 设计平台对象数据模型
  ```javascript
  Platform {
    id: string,
    name: string,
    url: string,  // 支持 {query} 占位符
    icon: string | null,  // Base64 或 SVG
    category: 'preset' | 'custom',
    enabled: boolean
  }
  ```

- [ ] **1.1.3** 设计配置迁移策略
  - 从旧格式 (directions.up = 'search') 迁移到新格式 (directions.up = ['baidu'])
  - 编写迁移函数
  - 参考文件: `background.js` initializeDefaultSettings()

#### 1.2 环境准备
- [ ] **1.2.1** 创建新文件 `content-scripts/platform-list-manager.js`
  - 用于管理平台列表UI
  - 预计 200-250 行代码

- [ ] **1.2.2** 更新 `manifest.json`
  - 确保新脚本被正确加载
  - 检查权限配置

- [ ] **1.2.3** 准备测试环境
  - 创建测试用例文件
  - 准备测试网页

#### 1.3 代码审查
- [ ] **1.3.1** 审查 `link-preview.js` 中 LinkWindowTextDragManager 类
  - 理解当前状态管理
  - 标记需要改造的方法
  - 参考行数: 229-410

- [ ] **1.3.2** 审查 `text-drag-config.js`
  - 理解 TextDragUtils 工具函数
  - 规划新增工具函数

- [ ] **1.3.3** 审查 `sidepanel.js`
  - 理解现有配置UI结构
  - 规划新增配置面板

---

### 第二阶段: 侧边栏配置UI开发 (8-10 小时)

#### 2.1 HTML 结构设计
- [ ] **2.1.1** 在 `sidepanel.html` 中添加平台配置面板
  - 预设平台列表展示
  - 自定义平台管理区域
  - 方向配置区域
  - 预计新增 150-200 行 HTML

- [ ] **2.1.2** 设计平台配置表单
  - 平台名称输入框
  - URL 模板输入框
  - 图标上传/选择
  - 启用/禁用开关

- [ ] **2.1.3** 设计方向配置UI
  - 四个方向选择器 (上/下/左/右)
  - 多选平台列表
  - 拖拽排序功能 (可选)

#### 2.2 样式设计
- [ ] **2.2.1** 在 `link-preview.css` 中添加配置面板样式
  - 平台列表样式
  - 表单样式
  - 响应式设计
  - 预计新增 100-150 行 CSS

- [ ] **2.2.2** 设计平台项目样式
  - 平台卡片样式
  - 高亮/悬停效果
  - 删除/编辑按钮

- [ ] **2.2.3** 设计方向配置样式
  - 方向选择器样式
  - 平台多选样式
  - 排序拖拽样式

#### 2.3 JavaScript 逻辑
- [ ] **2.3.1** 在 `sidepanel.js` 中添加平台管理逻辑
  - 加载预设平台列表
  - 加载自定义平台列表
  - 加载方向配置
  - 预计新增 200-250 行代码

- [ ] **2.3.2** 实现平台添加功能
  - 表单验证 (URL格式、名称长度等)
  - 图标处理 (压缩、Base64编码)
  - 保存到 chrome.storage.local
  - 实时更新UI

- [ ] **2.3.3** 实现平台删除功能
  - 删除确认对话框
  - 从存储中移除
  - 从方向配置中移除引用
  - 实时更新UI

- [ ] **2.3.4** 实现平台编辑功能
  - 编辑表单预填充
  - 更新存储
  - 实时更新UI

- [ ] **2.3.5** 实现方向配置功能
  - 多选平台
  - 保存配置
  - 实时更新UI
  - 验证配置有效性

#### 2.4 配置存储
- [ ] **2.4.1** 在 `background.js` 中更新配置初始化
  - 新增预设平台配置
  - 新增方向配置结构
  - 参考行数: 95-142

- [ ] **2.4.2** 实现配置验证函数
  - 验证平台数据完整性
  - 验证方向配置有效性
  - 验证URL格式

- [ ] **2.4.3** 实现配置备份和恢复
  - 保存配置备份
  - 配置损坏时自动恢复
  - 提供手动恢复选项

---

### 第三阶段: 核心拖拽逻辑改造 (12-15 小时)

#### 3.1 创建 PlatformListManager 类
- [ ] **3.1.1** 在 `content-scripts/platform-list-manager.js` 中创建类
  - 构造函数: 初始化配置和状态
  - 预计 200-250 行代码

- [ ] **3.1.2** 实现 createList() 方法
  - 创建列表容器 DOM
  - 创建平台项目 DOM
  - 绑定事件监听器
  - 计算初始位置
  - 添加到页面

- [ ] **3.1.3** 实现 updatePosition() 方法
  - 计算列表新位置
  - 处理视口边界
  - 使用 CSS transform 更新位置
  - 性能优化: 避免重排

- [ ] **3.1.4** 实现 highlightPlatform() 方法
  - 移除旧高亮
  - 添加新高亮
  - 触发平滑过渡动画

- [ ] **3.1.5** 实现 getSelectedPlatform() 方法
  - 根据鼠标位置检测选中平台
  - 返回平台对象或 null

- [ ] **3.1.6** 实现 destroy() 方法
  - 移除事件监听器
  - 移除 DOM 元素
  - 清理缓存

#### 3.2 改造 LinkWindowTextDragManager 类
- [ ] **3.2.1** 添加新状态变量
  - showPlatformList: boolean
  - currentDirection: string | null
  - selectedPlatformIndex: number
  - platformListRafId: number | null
  - platformListManager: PlatformListManager | null
  - 参考文件: `link-preview.js` 第229-270行

- [ ] **3.2.2** 改造 handleMouseMove() 方法
  - 保留原有距离检测逻辑
  - 新增: 当 isDragging 时，使用 requestAnimationFrame 更新列表
  - 调用 updatePlatformListDisplay()
  - 参考行数: 289-308

- [ ] **3.2.3** 新增 updatePlatformListDisplay() 方法
  - 识别拖拽方向
  - 获取该方向的平台列表
  - 如果无平台，隐藏列表
  - 如果有平台，创建或更新列表
  - 预计 50-80 行代码

- [ ] **3.2.4** 改造 handleMouseUp() 方法
  - 检查鼠标是否在某个平台上
  - 如果是，执行 executePlatformAction()
  - 如果否，执行原有的 executeAction()
  - 清理平台列表
  - 参考行数: 310-325

- [ ] **3.2.5** 新增 executePlatformAction() 方法
  - 获取选中平台的 URL 模板
  - 替换 {query} 占位符
  - 调用 dispatchTextDragEvent()
  - 预计 30-50 行代码

- [ ] **3.2.6** 新增 getPlatformsForDirection() 方法
  - 从配置中获取方向对应的平台列表
  - 验证平台有效性
  - 返回平台对象数组

#### 3.3 工具函数扩展
- [ ] **3.3.1** 在 `text-drag-config.js` 中添加工具函数
  - TextDragUtils.getPlatformById(id): Platform | null
  - TextDragUtils.validatePlatformUrl(url): boolean
  - TextDragUtils.calculateListPosition(mousePos, direction): {x, y}
  - 预计新增 80-120 行代码

- [ ] **3.3.2** 实现 getPlatformById() 函数
  - 从预设平台中查找
  - 从自定义平台中查找
  - 返回平台对象或 null

- [ ] **3.3.3** 实现 validatePlatformUrl() 函数
  - 验证 URL 格式
  - 验证是否包含 {query} 占位符
  - 返回 boolean

- [ ] **3.3.4** 实现 calculateListPosition() 函数
  - 根据方向计算列表位置
  - 处理视口边界
  - 返回 {x, y} 坐标

#### 3.4 事件处理改造
- [ ] **3.4.1** 改造 mousedown 事件处理
  - 保留原有逻辑
  - 初始化新状态变量

- [ ] **3.4.2** 改造 mousemove 事件处理
  - 保留原有逻辑
  - 新增 requestAnimationFrame 节流
  - 新增平台列表更新逻辑

- [ ] **3.4.3** 改造 mouseup 事件处理
  - 保留原有逻辑
  - 新增平台选择检测
  - 新增平台列表清理

- [ ] **3.4.4** 新增 mouseleave 事件处理
  - 隐藏平台列表
  - 重置状态

---

### 第四阶段: 性能优化和测试 (8-10 小时)

#### 4.1 性能优化
- [ ] **4.1.1** 实现 requestAnimationFrame 节流
  - 在 handleMouseMove 中使用 RAF
  - 避免频繁 DOM 更新
  - 参考代码: TEXT_DRAG_TECHNICAL_DESIGN.md

- [ ] **4.1.2** 优化 CSS 性能
  - 使用 will-change 属性
  - 使用 transform 而非 left/top
  - 使用 translate3d 启用 GPU 加速
  - 在 link-preview.css 中添加

- [ ] **4.1.3** 优化 DOM 操作
  - 缓存 DOM 元素引用
  - 使用 Map 存储平台项目 DOM
  - 复用 DOM 而非频繁创建/销毁

- [ ] **4.1.4** 性能监控
  - 添加性能测量代码
  - 监控 mousemove 处理时间
  - 监控 DOM 更新时间
  - 目标: 每帧 < 16.67ms

#### 4.2 单元测试
- [ ] **4.2.1** 编写方向识别测试
  - 测试 calculateDirection() 函数
  - 覆盖所有方向 (up, down, left, right)
  - 覆盖边界情况

- [ ] **4.2.2** 编写平台选择测试
  - 测试 getSelectedPlatform() 方法
  - 测试鼠标位置检测
  - 测试边界情况

- [ ] **4.2.3** 编写配置验证测试
  - 测试 validateConfig() 函数
  - 测试有效配置
  - 测试无效配置

- [ ] **4.2.4** 编写 URL 构建测试
  - 测试 buildSearchUrl() 函数
  - 测试占位符替换
  - 测试特殊字符编码

#### 4.3 集成测试
- [ ] **4.3.1** 测试完整拖拽流程
  - 选中文字 → 拖拽 → 显示列表 → 选择平台 → 创建预览
  - 验证每个步骤的正确性

- [ ] **4.3.2** 测试快速拖拽
  - 快速拖拽后立即松开
  - 验证不会误触发

- [ ] **4.3.3** 测试超出视口
  - 拖拽到窗口边缘
  - 验证列表位置调整正确

- [ ] **4.3.4** 测试列表边缘
  - 拖拽到列表边缘
  - 验证平台选择正确

#### 4.4 兼容性测试
- [ ] **4.4.1** 浏览器兼容性
  - Chrome 90+
  - Edge 90+
  - 验证功能正常

- [ ] **4.4.2** 设备兼容性
  - 桌面设备
  - 笔记本设备
  - 触控板设备
  - 验证交互流畅

- [ ] **4.4.3** 网页兼容性
  - 简单网页
  - 复杂网页 (大量DOM)
  - 包含 iframe 的网页
  - 验证功能正常

- [ ] **4.4.4** 性能测试
  - 使用 Chrome DevTools Performance
  - 监控帧率 (目标: 60fps)
  - 监控内存使用
  - 监控 CPU 使用率

#### 4.5 用户体验测试
- [ ] **4.5.1** 测试配置UI易用性
  - 添加平台是否直观
  - 删除平台是否方便
  - 配置方向是否清晰

- [ ] **4.5.2** 测试拖拽交互体验
  - 列表显示是否及时
  - 平台高亮是否清晰
  - 选择是否准确

- [ ] **4.5.3** 收集用户反馈
  - 邀请测试用户
  - 收集意见建议
  - 记录问题

---

### 第五阶段: iframe 支持 (6-8 小时)

#### 5.1 脚本注入
- [ ] **5.1.1** 在 `background.js` 中实现脚本注入
  - 使用 chrome.scripting.executeScript()
  - 注入到所有 frame (allFrames: true)
  - 处理注入失败情况

- [ ] **5.1.2** 配置 manifest.json
  - 添加 scripting 权限
  - 配置脚本注入规则

#### 5.2 跨域通信
- [ ] **5.2.1** 在 iframe 中实现 postMessage 发送
  - 监听文本拖拽事件
  - 发送消息到主页面
  - 包含文本、方向、位置信息

- [ ] **5.2.2** 在主页面中实现 postMessage 接收
  - 监听 message 事件
  - 验证消息来源
  - 处理 iframe 文本拖拽

- [ ] **5.2.3** 处理跨域安全
  - 验证消息来源
  - 验证消息格式
  - 防止恶意消息

#### 5.3 iframe 测试
- [ ] **5.3.1** 测试同域 iframe
  - 在同域 iframe 中拖拽文字
  - 验证功能正常

- [ ] **5.3.2** 测试跨域 iframe
  - 在跨域 iframe 中拖拽文字
  - 验证功能正常或正确处理

- [ ] **5.3.3** 测试嵌套 iframe
  - 在嵌套 iframe 中拖拽文字
  - 验证功能正常

---

### 第六阶段: 向后兼容性 (2-3 小时)

#### 6.1 配置迁移
- [ ] **6.1.1** 实现配置迁移函数
  - 检测旧配置格式
  - 转换为新格式
  - 保存迁移后的配置

- [ ] **6.1.2** 测试配置迁移
  - 测试旧配置迁移
  - 验证迁移后功能正常
  - 验证数据完整性

#### 6.2 功能兼容
- [ ] **6.2.1** 保留原有单一操作模式
  - 如果方向无平台配置，使用原有模式
  - 验证原有功能正常

- [ ] **6.2.2** 测试兼容性
  - 测试新旧功能混合使用
  - 验证无冲突

---

### 第七阶段: 代码审查和优化 (2-3 小时)

#### 7.1 代码质量
- [ ] **7.1.1** 代码审查
  - 检查代码风格一致性
  - 检查注释完整性
  - 检查错误处理

- [ ] **7.1.2** 代码优化
  - 移除重复代码
  - 优化算法复杂度
  - 优化内存使用

- [ ] **7.1.3** 文档完善
  - 添加函数注释
  - 添加类注释
  - 添加使用示例

#### 7.2 测试覆盖
- [ ] **7.2.1** 提高测试覆盖率
  - 目标: > 80%
  - 补充缺失的测试用例

- [ ] **7.2.2** 测试报告
  - 生成测试覆盖率报告
  - 记录测试结果

---

## 📊 工作量统计

| 阶段 | 任务数 | 预计工时 | 难度 |
|------|--------|---------|------|
| 1 | 13 | 2-3h | 简单 |
| 2 | 18 | 8-10h | 中等 |
| 3 | 24 | 12-15h | 中等 |
| 4 | 20 | 8-10h | 中等 |
| 5 | 9 | 6-8h | 困难 |
| 6 | 4 | 2-3h | 简单 |
| 7 | 6 | 2-3h | 简单 |
| **总计** | **94** | **40-52h** | **中等** |

---

## ✅ 验收标准

- [ ] 所有 94 个任务完成
- [ ] 平台配置UI完整可用
- [ ] 拖拽显示平台列表
- [ ] 选择平台后执行搜索
- [ ] 帧率保持 60fps
- [ ] 所有边界情况处理正确
- [ ] iframe 中文本拖拽正常工作
- [ ] 向后兼容原有功能
- [ ] 代码覆盖率 > 80%
- [ ] 用户体验满意度 > 4/5

---

## 📚 参考文档

- TEXT_DRAG_UPGRADE_FEASIBILITY.md - 可行性分析
- TEXT_DRAG_TECHNICAL_DESIGN.md - 技术方案设计
- TEXT_DRAG_RISKS_AND_IMPLEMENTATION.md - 风险分析
- TEXT_DRAG_UPGRADE_SUMMARY.md - 完整总结
- TEXT_DRAG_QUICK_REFERENCE.md - 快速参考

---

**最后更新**: 2025-10-24  
**文档状态**: 完成  
**适用版本**: MomentTabManager v1.0+

