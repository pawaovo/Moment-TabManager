# 🎨 窗口管理器画布式重构方案

## 📋 项目信息
- **项目名称**: MomentTabManager
- **功能模块**: 窗口管理器 (Window Manager)
- **重构类型**: 固定网格布局 → 自由画布式布局
- **影响范围**: 仅限窗口管理页面 (window-manager.html)
- **文档版本**: 1.0
- **创建日期**: 2025-01-23

## 🎯 重构概述

### 核心变更
将窗口管理功能从"固定网格布局"重构为"自由画布式布局"，用户通过拖拽标签页到画布创建窗口，可自由调整窗口大小和位置。

### 设计原则
- **原子组件化**: 6列 × 4行 = 24个最小单元格系统
- **拖拽驱动**: 从配置驱动改为拖拽交互驱动
- **网格吸附**: 所有操作必须对齐到网格系统
- **无重叠约束**: 防止窗口重叠和超出边界

## 🔧 技术方案

### 核心技术栈
- **拖拽库**: interact.js (CDN: https://cdn.jsdelivr.net/npm/interactjs@1.10.19/dist/interact.min.js)
- **布局系统**: CSS Grid + 绝对定位
- **网格系统**: 6列 × 4行 = 24个单元格
- **吸附算法**: interact.js snappers.grid()
- **碰撞检测**: 自定义算法防止窗口重叠

### 数据结构变更
```javascript
// 当前结构 (移除)
config = {
    rows: 1-4,
    firstRowCount: 1-6,
    secondRowCount: 1-6,
    thirdRowCount: 1-6,
    fourthRowCount: 1-6
}

// 新结构 (实现)
windows = [
    {
        id: 'window-1',           // 窗口唯一标识
        x: 0,                    // 网格X坐标 (0-5)
        y: 0,                    // 网格Y坐标 (0-3)
        width: 2,                // 宽度(单元格数) (1-6)
        height: 2,               // 高度(单元格数) (1-4)
        tabs: [                  // 窗口包含的标签页
            {
                id: 123,
                title: "页面标题",
                url: "https://example.com",
                favIconUrl: "..."
            }
        ]
    }
]
```

## 📁 文件修改清单

### 1. window-manager.html
- **移除**: 布局配置section (第32-80行)
- **保留**: 标签页管理、窗口操作、快捷键section
- **新增**: interact.js CDN引入
- **修改**: 画布容器结构

### 2. css/window-manager.css  
- **移除**: 固定网格布局样式 (.layout-* 类)
- **新增**: 画布样式、网格辅助样式、拖拽样式
- **修改**: 窗口样式支持绝对定位和调整手柄

### 3. js/window-manager.js
- **重构**: 核心WindowManager类
- **移除**: 布局配置相关方法
- **新增**: 拖拽、调整、吸附、碰撞检测功能
- **修改**: 配置保存/加载逻辑

## 🎨 画布网格系统

### 基础规格
- **画布尺寸**: 100% × 100% (填满.windows-container)
- **网格划分**: 6列 × 4行 = 24个单元格
- **单元格尺寸**: 
  - 宽度: calc(100% / 6) ≈ 16.67%
  - 高度: calc(100% / 4) = 25%

### 窗口尺寸规则
| 内容类型 | 标签页数量 | 默认尺寸 | 占用单元格 | 页面占比 |
|---------|-----------|---------|-----------|---------|
| 单个标签页 | 1个 | 2列×2行 | 4个单元格 | 1/6页面 |
| 标签页分组 | ≤3个 | 2列×2行 | 4个单元格 | 1/6页面 |
| 标签页分组 | 4-6个 | 3列×2行 | 6个单元格 | 1/4页面 |
| 标签页分组 | >6个 | 3列×3行 | 9个单元格 | 3/8页面 |

### 网格辅助视觉
- **触发时机**: 拖拽窗口或调整尺寸时显示
- **视觉效果**: 半透明网格线overlay
- **消失时机**: 操作完成后自动隐藏
- **样式**: 虚线边框，浅色背景

## 🚀 开发阶段规划

### 阶段一：环境准备 (30分钟)
- [ ] 引入interact.js CDN
- [ ] 创建开发分支
- [ ] 备份现有代码

### 阶段二：数据结构重构 (2小时)
- [ ] 重构WindowManager类配置结构
- [ ] 实现新的配置保存/加载逻辑
- [ ] 确保向后兼容性

### 阶段三：UI结构调整 (1小时)
- [ ] 移除布局配置section
- [ ] 改造画布容器结构
- [ ] 添加网格辅助overlay

### 阶段四：CSS样式重构 (1.5小时)
- [ ] 移除固定网格样式
- [ ] 实现画布和网格辅助样式
- [ ] 添加拖拽和调整样式

### 阶段五：拖拽功能实现 (3小时)
- [ ] 实现标签页拖拽事件
- [ ] 实现拖拽创建窗口逻辑
- [ ] 实现自动布局算法

### 阶段六：窗口调整功能 (2小时)
- [ ] 实现窗口拖拽移动
- [ ] 实现窗口尺寸调整
- [ ] 实现网格吸附功能

### 阶段七：碰撞检测 (1小时)
- [ ] 实现窗口重叠检测
- [ ] 实现边界约束检测
- [ ] 实现自动位置调整

### 阶段八：测试优化 (1.5小时)
- [ ] 功能测试
- [ ] 性能优化
- [ ] 兼容性测试

**总预估时间**: 12小时

## 📋 详细任务清单 (TodoList)

### 🔧 阶段一：环境准备

#### 1.1 引入interact.js库
- [ ] **在window-manager.html中添加CDN引用**
  - 位置: `</body>`标签前
  - CDN: `https://cdn.jsdelivr.net/npm/interactjs@1.10.19/dist/interact.min.js`
  - 验证: 控制台检查`interact`对象是否可用
  - **预计时间**: 10分钟

#### 1.2 创建开发分支
- [ ] **Git分支管理**
  - 创建分支: `git checkout -b feature/canvas-refactor`
  - 提交当前状态: `git commit -m "备份：开始画布重构"`
  - **预计时间**: 5分钟

#### 1.3 代码备份
- [ ] **备份关键文件**
  - 复制: `window-manager.html` → `window-manager.html.backup`
  - 复制: `css/window-manager.css` → `css/window-manager.css.backup`
  - 复制: `js/window-manager.js` → `js/window-manager.js.backup`
  - **预计时间**: 15分钟

### 🏗️ 阶段二：数据结构重构

#### 2.1 重构配置对象结构
- [ ] **修改WindowManager构造函数**
  - 文件: `js/window-manager.js`
  - 移除: `config.rows, firstRowCount, secondRowCount, thirdRowCount, fourthRowCount`
  - 新增: `this.windows = []` (窗口数组)
  - 新增: `this.canvasConfig = { gridCols: 6, gridRows: 4 }`
  - **预计时间**: 30分钟

#### 2.2 实现窗口数据管理
- [ ] **添加窗口CRUD方法**
  - 方法: `createWindow(x, y, width, height, tabs)`
  - 方法: `updateWindow(id, properties)`
  - 方法: `deleteWindow(id)`
  - 方法: `findWindowAt(x, y)`
  - **预计时间**: 45分钟

#### 2.3 重构配置保存/加载
- [ ] **更新存储逻辑**
  - 修改: `saveConfig()` 方法保存新结构
  - 修改: `loadConfig()` 方法加载新结构
  - 实现: 向后兼容性检查和迁移
  - 测试: 配置保存和加载功能
  - **预计时间**: 45分钟

### 🎨 阶段三：UI结构调整

#### 3.1 移除布局配置section
- [ ] **删除HTML布局配置部分**
  - 文件: `window-manager.html`
  - 删除: 第32-80行 (布局配置section)
  - 保留: 标签页管理、窗口操作、快捷键section
  - 验证: 侧边栏结构完整性
  - **预计时间**: 15分钟

#### 3.2 改造画布容器
- [ ] **重构.windows-container结构**
  - 添加: `<div class="canvas-container" id="canvasContainer">`
  - 添加: `<div class="grid-overlay" id="gridOverlay">`
  - 添加: `<div class="windows-layer" id="windowsLayer">`
  - 移除: 原有的空状态提示
  - **预计时间**: 20分钟

#### 3.3 添加网格辅助overlay
- [ ] **创建网格辅助HTML结构**
  - 添加: 24个网格单元格div
  - 添加: 网格线和标识
  - 设置: 默认隐藏状态
  - **预计时间**: 25分钟

### 🎨 阶段四：CSS样式重构

#### 4.1 移除固定网格样式
- [ ] **清理旧的布局样式**
  - 文件: `css/window-manager.css`
  - 删除: `.layout-*` 相关样式 (第355-366行)
  - 删除: `.windows-grid` 样式
  - 保留: 窗口基础样式
  - **预计时间**: 20分钟

#### 4.2 实现画布样式
- [ ] **添加画布容器样式**
  - 样式: `.canvas-container` (相对定位，100%尺寸)
  - 样式: `.windows-layer` (绝对定位层)
  - 样式: `.grid-overlay` (网格辅助层)
  - 响应式: 确保各种屏幕尺寸适配
  - **预计时间**: 30分钟

#### 4.3 网格辅助视觉样式
- [ ] **实现网格辅助效果**
  - 样式: 网格线 (虚线边框)
  - 样式: 半透明背景
  - 动画: 显示/隐藏过渡效果
  - 状态: 默认隐藏，拖拽时显示
  - **预计时间**: 25分钟

#### 4.4 窗口拖拽调整样式
- [ ] **添加交互样式**
  - 样式: 拖拽状态 (`.dragging`)
  - 样式: 调整手柄 (`.resize-handle`)
  - 样式: 悬停效果
  - 样式: 选中状态
  - **预计时间**: 25分钟

### 🖱️ 阶段五：拖拽功能实现

#### 5.1 标签页拖拽事件
- [ ] **实现标签页拖拽源**
  - 修改: `bindTabEvents()` 方法
  - 添加: HTML5 Drag API 或 interact.js 拖拽
  - 事件: `dragstart`, `drag`, `dragend`
  - 数据: 传递标签页信息
  - **预计时间**: 45分钟

#### 5.2 画布拖拽目标
- [ ] **实现画布拖拽接收**
  - 方法: `setupCanvasDropZone()`
  - 事件: `dragover`, `drop`
  - 逻辑: 计算拖拽位置对应的网格坐标
  - 验证: 检查目标位置是否可用
  - **预计时间**: 45分钟

#### 5.3 自动窗口创建逻辑
- [ ] **实现拖拽创建窗口**
  - 方法: `createWindowFromDrop(tabData, gridX, gridY)`
  - 逻辑: 根据标签页数量确定窗口尺寸
  - 逻辑: 自动寻找合适的放置位置
  - 逻辑: 创建窗口DOM元素
  - **预计时间**: 60分钟

#### 5.4 自动布局算法
- [ ] **实现智能布局**
  - 算法: 寻找空白区域
  - 算法: 优化窗口排列
  - 逻辑: 处理画布空间不足情况
  - 提示: 用户反馈机制
  - **预计时间**: 50分钟

### 🔧 阶段六：窗口调整功能

#### 6.1 窗口拖拽移动
- [ ] **实现窗口位置调整**
  - 集成: interact.js draggable
  - 配置: 网格吸附 (snappers.grid)
  - 约束: 边界限制 (restrictRect)
  - 事件: 移动过程中的碰撞检测
  - **预计时间**: 40分钟

#### 6.2 窗口尺寸调整
- [ ] **实现窗口大小调整**
  - 集成: interact.js resizable
  - 配置: 网格吸附尺寸 (snapSize)
  - 约束: 最小/最大尺寸限制
  - 手柄: 四角和四边调整手柄
  - **预计时间**: 40分钟

#### 6.3 网格吸附功能
- [ ] **实现精确网格对齐**
  - 配置: `interact.snappers.grid({ x: gridWidth, y: gridHeight })`
  - 视觉: 拖拽时显示网格辅助
  - 逻辑: 坐标转换 (像素 ↔ 网格)
  - 优化: 吸附灵敏度调整
  - **预计时间**: 40分钟

### 🛡️ 阶段七：碰撞检测

#### 7.1 窗口重叠检测
- [ ] **实现碰撞检测算法**
  - 算法: 矩形重叠检测
  - 方法: `checkWindowCollision(window1, window2)`
  - 方法: `findCollisions(targetWindow)`
  - 优化: 空间索引提升性能
  - **预计时间**: 30分钟

#### 7.2 边界约束检测
- [ ] **实现边界限制**
  - 检测: 窗口是否超出画布边界
  - 方法: `checkBoundaryConstraints(window)`
  - 修正: 自动调整超出边界的窗口
  - 提示: 用户操作反馈
  - **预计时间**: 20分钟

#### 7.3 自动位置调整
- [ ] **实现智能位置修正**
  - 算法: 寻找最近的可用位置
  - 方法: `findNearestValidPosition(x, y, width, height)`
  - 逻辑: 冲突解决策略
  - 动画: 平滑的位置调整过渡
  - **预计时间**: 10分钟

### 🧪 阶段八：测试优化

#### 8.1 功能测试
- [ ] **全面功能验证**
  - 测试: 标签页拖拽创建窗口
  - 测试: 窗口拖拽移动
  - 测试: 窗口尺寸调整
  - 测试: 网格吸附效果
  - 测试: 碰撞检测和边界约束
  - 测试: 配置保存和加载
  - **预计时间**: 45分钟

#### 8.2 性能优化
- [ ] **性能调优**
  - 优化: 拖拽事件节流
  - 优化: 碰撞检测算法
  - 优化: DOM操作批量处理
  - 监控: 内存使用情况
  - **预计时间**: 30分钟

#### 8.3 兼容性测试
- [ ] **浏览器兼容性**
  - 测试: Chrome (主要目标)
  - 测试: Edge
  - 测试: Firefox
  - 修复: 兼容性问题
  - **预计时间**: 15分钟

## 🔍 关键技术实现细节

### 网格坐标转换
```javascript
// 像素坐标转网格坐标
function pixelToGrid(pixelX, pixelY) {
    const gridWidth = canvasWidth / 6;
    const gridHeight = canvasHeight / 4;
    return {
        x: Math.floor(pixelX / gridWidth),
        y: Math.floor(pixelY / gridHeight)
    };
}

// 网格坐标转像素坐标
function gridToPixel(gridX, gridY) {
    const gridWidth = canvasWidth / 6;
    const gridHeight = canvasHeight / 4;
    return {
        x: gridX * gridWidth,
        y: gridY * gridHeight
    };
}
```

### interact.js配置示例
```javascript
// 窗口拖拽配置
interact('.window-item').draggable({
    modifiers: [
        interact.modifiers.snap({
            targets: [
                interact.snappers.grid({ x: gridWidth, y: gridHeight })
            ]
        }),
        interact.modifiers.restrict({
            restriction: 'parent',
            endOnly: true
        })
    ],
    listeners: {
        move: dragMoveListener,
        end: dragEndListener
    }
});

// 窗口调整配置
interact('.window-item').resizable({
    edges: { left: true, right: true, bottom: true, top: true },
    modifiers: [
        interact.modifiers.snapSize({
            targets: [
                interact.snappers.grid({ width: gridWidth, height: gridHeight })
            ]
        }),
        interact.modifiers.restrictSize({
            min: { width: gridWidth, height: gridHeight },
            max: { width: gridWidth * 6, height: gridHeight * 4 }
        })
    ],
    listeners: {
        move: resizeMoveListener,
        end: resizeEndListener
    }
});
```

## ⚠️ 重要注意事项

### 兼容性保证
- 新配置结构必须向后兼容
- 旧配置自动迁移到新结构
- 保留所有现有的标签页管理功能

### 性能考虑
- 拖拽事件使用节流处理
- 碰撞检测算法优化
- DOM操作最小化

### 用户体验
- 提供清晰的视觉反馈
- 操作失败时给出明确提示
- 保持操作的直观性

## 📊 成功标准

### 功能完整性
- [ ] 所有拖拽功能正常工作
- [ ] 网格吸附精确无误
- [ ] 碰撞检测有效防止重叠
- [ ] 配置保存和加载正常

### 用户体验
- [ ] 操作流畅无卡顿
- [ ] 视觉反馈清晰
- [ ] 错误处理友好

### 代码质量
- [ ] 代码结构清晰
- [ ] 注释完整
- [ ] 无明显性能问题

---

**文档状态**: ✅ 完成
**最后更新**: 2025-01-23
**负责人**: 开发团队
