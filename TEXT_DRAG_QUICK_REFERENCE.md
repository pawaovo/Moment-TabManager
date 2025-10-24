# 文本拖拽功能升级 - 快速参考指南

## 📌 核心结论

| 问题 | 答案 | 关键点 |
|------|------|--------|
| **可行性** | ✅ 完全可行 | 技术成熟，方案清晰 |
| **难度** | 中等 | 36-46 小时工作量 |
| **性能** | ✅ 可控 | requestAnimationFrame 节流 |
| **风险** | 可管理 | 多层防护 + 充分测试 |
| **兼容性** | ✅ 支持 | 向后兼容 + iframe 支持 |

---

## 🎯 需求快速总结

### 三大核心需求

1. **自定义平台配置**
   - 用户可添加/删除/编辑搜索平台
   - 预设常用平台（Google、DeepSeek、Wikipedia等）
   - 支持自定义平台URL模板

2. **方向拖拽列表配置**
   - 每个方向（上/下/左/右）可配置多个平台
   - 示例: 向上拖拽 → [Google, DeepSeek, Wikipedia]
   - 支持 0-N 个平台（不限数量）

3. **交互流程改造**
   - 拖拽时实时显示平台列表
   - 用户选择平台后执行搜索
   - 保持原有单一操作模式作为备选

---

## 🔑 关键技术方案

### 性能优化三层策略

```javascript
// 1. requestAnimationFrame 节流
if (!this.platformListRafId) {
    this.platformListRafId = requestAnimationFrame(() => {
        this.updatePlatformList();
        this.platformListRafId = null;
    });
}

// 2. CSS 优化
.platform-list {
    will-change: transform;
    transform: translate3d(0, 0, 0);  /* GPU加速 */
}

// 3. DOM 缓存
this.itemElements = new Map();  // 复用DOM元素
```

### 新增类和改造

**新增**: `PlatformListManager`
- 列表DOM管理
- 事件绑定
- 位置计算

**改造**: `LinkWindowTextDragManager`
- 新增状态变量
- 改造 handleMouseMove
- 改造 handleMouseUp

---

## 📊 工作量分解

| 阶段 | 任务 | 工时 | 难度 |
|------|------|------|------|
| 1 | 数据结构 + 配置存储 | 2-3h | 简单 |
| 2 | 侧边栏配置UI | 8-10h | 中等 |
| 3 | 核心拖拽逻辑 | 12-15h | 中等 |
| 4 | 性能优化 + 测试 | 8-10h | 中等 |
| 5 | iframe 支持 | 6-8h | 困难 |
| **总计** | | **36-46h** | **中等** |

---

## 🔄 新的事件流程

```
mousedown (记录起点)
  ↓
mousemove (距离 < 20px)
  ↓
mousemove (距离 >= 20px)
  ├─ isDragging = true
  ├─ 识别方向
  └─ 显示平台列表 ← 新增
  ↓
mousemove (继续拖拽)
  ├─ 更新列表位置
  └─ 高亮平台 ← 新增
  ↓
mouseup
  ├─ 检测选中平台
  └─ 执行平台搜索 ← 改造
```

---

## 📁 需要修改的文件

### 核心文件 (6个)

```
content-scripts/
├── text-drag-config.js      ← 新增平台配置 (200行)
└── link-preview.js          ← 核心逻辑改造 (300行)

js/
└── sidepanel.js             ← 配置UI逻辑 (400行)

css/
└── link-preview.css         ← 列表样式 (150行)

sidepanel.html              ← 配置面板 (200行)

background.js               ← 配置存储 (50行)
```

**总代码量**: ~1300 行新增/修改

---

## 💾 新配置数据结构

```javascript
{
    textActions: {
        enabled: true,
        
        // 预设平台
        presetPlatforms: {
            google: { name: 'Google', url: '...', icon: '...' },
            deepseek: { name: 'DeepSeek', url: '...', icon: '...' },
            // ...
        },
        
        // 自定义平台
        customPlatforms: {
            'custom-1': { name: '...', url: '...', icon: null }
        },
        
        // 方向配置（支持多平台）
        directions: {
            up: ['google', 'deepseek', 'wikipedia'],
            down: ['baidu-translate'],
            left: ['google'],
            right: ['baidu']
        },
        
        // UI配置
        listPosition: 'auto',
        listStyle: 'vertical',
        showIcons: true,
        animationEnabled: true
    }
}
```

---

## ⚠️ 主要风险 (5个)

| # | 风险 | 等级 | 解决方案 |
|---|------|------|---------|
| 1 | 性能下降 | 🟡 中 | requestAnimationFrame + CSS优化 |
| 2 | 用户误触发 | 🟡 中 | 多层防护 + 确认机制 |
| 3 | 列表遮挡 | 🟡 中 | 智能位置计算 + 自动调整 |
| 4 | iframe 不兼容 | 🔴 高 | 脚本注入 + postMessage |
| 5 | 配置损坏 | 🟡 中 | 配置验证 + 备份恢复 |

---

## ✅ 验收标准 (8项)

- [ ] 平台配置UI完整可用
- [ ] 拖拽显示平台列表
- [ ] 选择平台后执行搜索
- [ ] 帧率保持 60fps
- [ ] 所有边界情况处理正确
- [ ] iframe 中文本拖拽正常工作
- [ ] 向后兼容原有功能
- [ ] 代码覆盖率 > 80%

---

## 🚀 实现顺序 (5阶段)

### 第1阶段: 准备 (2-3h)
- [ ] 设计新配置结构
- [ ] 创建平台管理系统
- [ ] 准备测试用例

### 第2阶段: UI (8-10h)
- [ ] 设计配置面板
- [ ] 实现平台管理
- [ ] 实现方向配置

### 第3阶段: 逻辑 (12-15h)
- [ ] 创建 PlatformListManager
- [ ] 改造 handleMouseMove
- [ ] 改造 handleMouseUp

### 第4阶段: 优化 (8-10h)
- [ ] 性能测试
- [ ] 兼容性测试
- [ ] 边界情况测试

### 第5阶段: iframe (6-8h)
- [ ] 脚本注入
- [ ] postMessage 通信
- [ ] iframe 测试

---

## 🧪 测试清单

### 单元测试
- [ ] 方向识别
- [ ] 平台选择
- [ ] 配置验证
- [ ] URL构建

### 集成测试
- [ ] 完整拖拽流程
- [ ] 快速拖拽
- [ ] 超出视口
- [ ] 列表边缘

### 兼容性测试
- [ ] Chrome 90+
- [ ] Edge 90+
- [ ] 桌面设备
- [ ] 笔记本设备
- [ ] 触控板
- [ ] 简单网页
- [ ] 复杂网页
- [ ] iframe 网页

---

## 📚 相关文档

1. **TEXT_DRAG_UPGRADE_FEASIBILITY.md** - 详细可行性分析
2. **TEXT_DRAG_TECHNICAL_DESIGN.md** - 技术方案设计
3. **TEXT_DRAG_RISKS_AND_IMPLEMENTATION.md** - 风险分析
4. **TEXT_DRAG_UPGRADE_SUMMARY.md** - 完整总结

---

## 💡 关键建议

### 优先级
1. **必做**: 数据结构 + 配置存储
2. **必做**: 侧边栏配置UI
3. **必做**: 核心拖拽逻辑
4. **应做**: 性能优化
5. **可做**: iframe 支持

### 风险管理
- 提前进行性能测试
- 在多个网站测试
- 收集用户反馈
- 迭代优化

### 质量保证
- 代码覆盖率 > 80%
- 帧率保持 60fps
- 用户体验满意度 > 4/5

---

## 🎓 技术亮点

1. **requestAnimationFrame 节流** - 性能优化
2. **CSS transform** - GPU加速
3. **DOM 缓存** - 内存优化
4. **多层防护** - 用户体验
5. **向后兼容** - 平滑升级

---

## 📞 快速问答

**Q: 需要多长时间？**
A: 36-46 小时（约 1-2 周）

**Q: 会影响性能吗？**
A: 不会，通过 requestAnimationFrame 节流可保持 60fps

**Q: 支持 iframe 吗？**
A: 支持，通过脚本注入 + postMessage 通信

**Q: 向后兼容吗？**
A: 完全兼容，原有功能保留

**Q: 如何处理快速拖拽？**
A: 多层防护（距离、时间、确认）

---

**最后更新**: 2025-10-24
**文档类型**: 快速参考指南
**适用场景**: 项目启动、进度跟踪、快速查询

