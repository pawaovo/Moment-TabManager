# 文本拖拽功能 - 完整执行路径追踪

## 🎯 核心问题答案

**问题**: 方向识别和操作触发是在拖拽期间还是拖拽结束后？

**答案**: ✅ **在拖拽结束后（mouseup事件）**

---

## 📍 代码执行路径追踪

### 路径1: mousedown 事件处理

```
用户选中文字并按住鼠标
    ↓
document.addEventListener('mousedown', handleMouseDown)
    ↓
handleMouseDown(e) {
    // 第271-287行
    if (!this.config?.enabled || e.button !== 0) return;  // ← 检查条件
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;      // ← 检查是否有选中文字
    
    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 1) return; // ← 检查文字长度
    
    if (!TextDragUtils.isClickInSelection(e, selection)) return;  // ← 检查点击位置
    
    // ✅ 初始化潜在拖拽状态
    this.initializePotentialDragState(e, selectedText);
    e.preventDefault();
    LinkWindowLogger.drag('准备文本拖拽', selectedText.substring(0, 50));
}

initializePotentialDragState(event, selectedText) {
    // 第328-333行
    this.isPotentialDrag = true;                    // ← 标记为潜在拖拽
    this.startPosition = { x: event.clientX, y: event.clientY };  // ← 记录起点
    this.selectedText = selectedText;               // ← 保存文字
    this.dragStartTime = Date.now();                // ← 记录时间
}

状态: isPotentialDrag = true, isDragging = false
方向: ❌ 未计算
操作: ❌ 未触发
```

---

### 路径2: mousemove 事件处理（拖拽中）

```
用户拖拽鼠标（距离 < 20px）
    ↓
document.addEventListener('mousemove', handleMouseMove)
    ↓
handleMouseMove(e) {
    // 第289-308行
    this.lastMousePosition = { x: e.clientX, y: e.clientY };  // ← 更新鼠标位置
    
    // 检查是否从潜在拖拽转为真正拖拽
    if (this.isPotentialDrag && !this.isDragging) {
        // 计算距离
        this.dragDistance = TextDragUtils.calculateDistance(
            this.startPosition,
            this.lastMousePosition
        );
        
        // 距离 < 20px，不进入真正拖拽
        if (this.dragDistance >= TEXT_DRAG_CONFIG.DRAG_THRESHOLD) {  // 20px
            this.isDragging = true;
            this.isPotentialDrag = false;
            LinkWindowLogger.drag('开始真正拖拽', `距离: ${this.dragDistance.toFixed(0)}px`);
        }
    }
    
    if (this.isDragging) {
        this.endPosition = this.lastMousePosition;
        document.body.style.cursor = 'grabbing';  // ← 仅改变光标
    }
}

状态: isPotentialDrag = true, isDragging = false
方向: ❌ 未计算
操作: ❌ 未触发
```

---

### 路径3: mousemove 事件处理（达到阈值）

```
用户继续拖拽鼠标（距离 >= 20px）
    ↓
handleMouseMove(e) {
    this.lastMousePosition = { x: e.clientX, y: e.clientY };
    
    if (this.isPotentialDrag && !this.isDragging) {
        this.dragDistance = TextDragUtils.calculateDistance(
            this.startPosition,
            this.lastMousePosition
        );
        
        // ✅ 距离 >= 20px，进入真正拖拽
        if (this.dragDistance >= TEXT_DRAG_CONFIG.DRAG_THRESHOLD) {
            this.isDragging = true;           // ← 设置为真正拖拽
            this.isPotentialDrag = false;
            LinkWindowLogger.drag('开始真正拖拽', `距离: ${this.dragDistance.toFixed(0)}px`);
        }
    }
    
    if (this.isDragging) {
        this.endPosition = this.lastMousePosition;  // ← 更新结束位置
        document.body.style.cursor = 'grabbing';    // ← 改变光标
    }
}

状态: isPotentialDrag = false, isDragging = true
方向: ❌ 仍未计算（因为拖拽还在进行）
操作: ❌ 仍未触发
```

---

### 路径4: mousemove 事件处理（继续拖拽）

```
用户继续拖拽鼠标（拖拽中）
    ↓
handleMouseMove(e) {
    this.lastMousePosition = { x: e.clientX, y: e.clientY };
    
    // isDragging 已为 true，跳过第一个 if 块
    
    if (this.isDragging) {
        this.endPosition = this.lastMousePosition;  // ← 持续更新结束位置
        document.body.style.cursor = 'grabbing';
    }
}

状态: isPotentialDrag = false, isDragging = true
方向: ❌ 仍未计算
操作: ❌ 仍未触发
```

---

### 路径5: mouseup 事件处理 ✅ 关键时刻

```
用户松开鼠标
    ↓
document.addEventListener('mouseup', handleMouseUp)
    ↓
handleMouseUp(e) {
    // 第310-325行
    
    // ✅ 只有在真正拖拽时才执行动作
    if (this.isDragging) {
        // 验证拖拽条件
        if (this.validateAndExecuteDrag()) {
            // ✅ 第一次计算方向
            const direction = TextDragUtils.calculateDirection(
                this.startPosition,
                this.endPosition
            );
            
            // ✅ 第一次触发操作
            this.executeAction(direction, this.selectedText);
        }
        
        // 重置拖拽状态
        this.resetDragState();
    } else if (this.isPotentialDrag) {
        // 如果只是点击而没有拖拽
        this.resetDragState(true);
        LinkWindowLogger.drag('仅点击，未拖拽，取消操作');
    }
}

状态: isDragging = true（进入此分支）
方向: ✅ 计算方向（第一次）
操作: ✅ 触发操作（第一次）
```

---

## 🔍 方向计算详解

```javascript
// 第315行：计算方向
const direction = TextDragUtils.calculateDirection(
    this.startPosition,      // { x: 100, y: 200 }
    this.endPosition         // { x: 150, y: 150 }
);

// text-drag-config.js 第82-92行
static calculateDirection(start, end) {
    const deltaX = end.x - start.x;  // 150 - 100 = 50
    const deltaY = end.y - start.y;  // 150 - 200 = -50
    
    // 比较绝对值
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // |50| > |-50| ? false
        return deltaX > 0 ? 'right' : 'left';
    } else {
        // 进入此分支
        return deltaY > 0 ? 'down' : 'up';  // -50 > 0 ? false → 'up'
    }
}

// 结果: direction = 'up'
```

---

## 🚀 操作执行详解

```javascript
// 第316行：执行操作
this.executeAction(direction, this.selectedText);

// link-preview.js 第358-379行
executeAction(direction, text) {
    // 获取配置的动作
    const action = this.config.directions[direction];  // 'up' → 'search'
    
    // 检查动作是否有效
    if (!TextDragUtils.shouldExecuteAction(action)) {
        LinkWindowLogger.drag(`方向 ${direction} 未配置有效动作`);
        return;
    }
    
    LinkWindowLogger.drag(`执行动作: ${action} (方向: ${direction}, 文本: "${text}")`);
    
    try {
        // 构建URL
        const result = this.buildActionUrl(action, text);
        // result = { 
        //   url: 'https://www.baidu.com/s?wd=...',
        //   title: '百度搜索: ...'
        // }
        
        if (result) {
            // 发送事件
            this.dispatchTextDragEvent(result, text, action, direction);
            LinkWindowLogger.success(`文本拖拽预览事件已发送: ${result.title}`);
        }
    } catch (error) {
        LinkWindowUtils.logError('执行文本拖拽动作失败', error);
    }
}
```

---

## 📊 时间轴总结

| 时刻 | 事件 | 代码行 | 方向识别 | 操作触发 | 状态变化 |
|------|------|--------|---------|---------|---------|
| T0 | mousedown | 271-287 | ❌ | ❌ | isPotentialDrag=true |
| T1 | mousemove (< 20px) | 289-308 | ❌ | ❌ | 无变化 |
| T2 | mousemove (>= 20px) | 296-301 | ❌ | ❌ | isDragging=true |
| T3 | mousemove (继续) | 304-307 | ❌ | ❌ | endPosition更新 |
| **T4** | **mouseup** | **310-316** | **✅** | **✅** | 计算方向+触发操作 |

---

## 🎯 关键代码位置

| 功能 | 文件 | 行数 | 说明 |
|------|------|------|------|
| mousedown处理 | link-preview.js | 271-287 | 初始化潜在拖拽 |
| mousemove处理 | link-preview.js | 289-308 | 检测阈值，更新光标 |
| **mouseup处理** | **link-preview.js** | **310-325** | **✅ 计算方向+触发操作** |
| 方向计算 | text-drag-config.js | 82-92 | calculateDirection() |
| 操作执行 | link-preview.js | 358-379 | executeAction() |
| 配置参数 | text-drag-config.js | 7-10 | DRAG_THRESHOLD=20px |

---

## 💡 设计原理

这个设计遵循**标准的拖拽交互模式**:

1. **mousedown** → 准备阶段
   - 记录起点
   - 保存文字
   - 等待用户拖拽

2. **mousemove** → 进行中
   - 检测是否达到阈值
   - 提供视觉反馈（光标变化）
   - 持续更新位置

3. **mouseup** → 完成阶段 ✅
   - 计算最终方向
   - 触发对应操作
   - 创建预览窗口

**为什么在mouseup时计算方向？**
- ✅ 确保有完整的拖拽轨迹
- ✅ 避免中途计算导致的不准确
- ✅ 符合用户直觉（拖拽完成后才执行）
- ✅ 性能优化（只计算一次）

---

**最后更新**: 2025-10-24

