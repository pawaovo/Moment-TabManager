# 文本拖拽功能升级 - 技术方案设计

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    侧边栏 (sidepanel.js)                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  平台配置UI                                       │  │
│  │  - 预设平台列表                                   │  │
│  │  - 自定义平台管理                                 │  │
│  │  - 方向配置（多平台）                             │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              后台脚本 (background.js)                    │
│  ┌──────────────────────────────────────────────────┐  │
│  │  配置存储和验证                                   │  │
│  │  - chrome.storage.local 管理                      │  │
│  │  - 配置版本控制                                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           内容脚本 (link-preview.js)                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LinkWindowTextDragManager (改造)                │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 1. 拖拽检测 (handleMouseMove)              │ │  │
│  │  │    - 计算距离                              │ │  │
│  │  │    - 识别方向                              │ │  │
│  │  │    - 触发平台列表显示                      │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 2. 平台列表管理 (新增)                     │ │  │
│  │  │    - 创建/更新/销毁列表                    │ │  │
│  │  │    - 平台高亮管理                          │ │  │
│  │  │    - 位置计算                              │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 3. 平台选择 (handleMouseUp 改造)          │ │  │
│  │  │    - 检测鼠标位置                          │ │  │
│  │  │    - 执行选中平台的操作                    │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PlatformListManager (新增类)                    │  │
│  │  - 列表DOM管理                                   │  │
│  │  - 事件绑定                                       │  │
│  │  - 位置计算                                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  样式 (link-preview.css)                │
│  - 平台列表样式                                         │
│  - 平台项目样式                                         │
│  - 高亮/悬停效果                                        │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 关键技术点

### 1. 性能优化策略

#### requestAnimationFrame 节流
```javascript
class LinkWindowTextDragManager {
    constructor() {
        this.platformListRafId = null;
    }
    
    handleMouseMove(e) {
        if (this.isDragging && !this.platformListRafId) {
            this.platformListRafId = requestAnimationFrame(() => {
                this.updatePlatformList();
                this.platformListRafId = null;
            });
        }
    }
}
```

#### CSS 优化
```css
.platform-list {
    will-change: transform;
    transform: translate3d(0, 0, 0);  /* GPU加速 */
    backface-visibility: hidden;
}

.platform-item {
    transition: background-color 0.15s ease;  /* 平滑过渡 */
}
```

#### DOM 缓存
```javascript
class PlatformListManager {
    constructor() {
        this.listElement = null;
        this.itemElements = new Map();  // 缓存平台项目
    }
    
    updateList(platforms) {
        // 复用现有DOM，不频繁创建/销毁
        this.itemElements.forEach((el, id) => {
            if (!platforms.find(p => p.id === id)) {
                el.remove();
                this.itemElements.delete(id);
            }
        });
    }
}
```

---

### 2. 状态管理

#### 新增状态变量
```javascript
class LinkWindowTextDragManager {
    constructor() {
        // 原有状态
        this.isDragging = false;
        this.isPotentialDrag = false;
        
        // 新增状态
        this.showPlatformList = false;
        this.currentDirection = null;
        this.selectedPlatformIndex = -1;
        this.platformListRafId = null;
        this.platformHoverTimeout = null;
        this.platformListManager = null;
    }
}
```

#### 状态转移图
```
mousedown
  ↓
isPotentialDrag = true
  ↓
mousemove (distance < 20px)
  ↓
isPotentialDrag = true
  ↓
mousemove (distance >= 20px)
  ↓
isDragging = true
showPlatformList = true  ← 新增
currentDirection = 'up'  ← 新增
  ↓
mousemove (继续拖拽)
  ↓
updatePlatformList()  ← 新增
selectedPlatformIndex = 0  ← 新增（鼠标悬停）
  ↓
mouseup
  ↓
executePlatformAction()  ← 改造
resetDragState()
```

---

### 3. 平台列表管理

#### PlatformListManager 类设计
```javascript
class PlatformListManager {
    constructor(config) {
        this.config = config;
        this.listElement = null;
        this.itemElements = new Map();
        this.currentDirection = null;
    }
    
    // 创建列表
    createList(platforms, position) {
        // 1. 创建容器
        // 2. 创建平台项目
        // 3. 绑定事件
        // 4. 计算位置
        // 5. 添加到DOM
    }
    
    // 更新列表位置
    updatePosition(mouseX, mouseY) {
        // 1. 计算最佳位置
        // 2. 处理视口边界
        // 3. 更新CSS transform
    }
    
    // 高亮平台
    highlightPlatform(index) {
        // 1. 移除旧高亮
        // 2. 添加新高亮
        // 3. 触发动画
    }
    
    // 销毁列表
    destroy() {
        // 1. 移除事件监听
        // 2. 移除DOM
        // 3. 清理缓存
    }
}
```

---

### 4. 事件流改造

#### handleMouseMove 改造
```javascript
handleMouseMove(e) {
    this.lastMousePosition = { x: e.clientX, y: e.clientY };
    
    // 原有逻辑：检测拖拽阈值
    if (this.isPotentialDrag && !this.isDragging) {
        this.dragDistance = TextDragUtils.calculateDistance(
            this.startPosition,
            this.lastMousePosition
        );
        
        if (this.dragDistance >= TEXT_DRAG_CONFIG.DRAG_THRESHOLD) {
            this.isDragging = true;
            this.isPotentialDrag = false;
        }
    }
    
    // 新增逻辑：显示平台列表
    if (this.isDragging && !this.platformListRafId) {
        this.platformListRafId = requestAnimationFrame(() => {
            this.updatePlatformListDisplay();
            this.platformListRafId = null;
        });
    }
}

updatePlatformListDisplay() {
    // 1. 识别方向
    const direction = TextDragUtils.calculateDirection(
        this.startPosition,
        this.lastMousePosition
    );
    
    // 2. 获取该方向的平台列表
    const platforms = this.config.directions[direction] || [];
    
    // 3. 如果没有平台，隐藏列表
    if (platforms.length === 0) {
        this.platformListManager?.destroy();
        return;
    }
    
    // 4. 创建或更新列表
    if (!this.showPlatformList) {
        this.platformListManager = new PlatformListManager(this.config);
        this.platformListManager.createList(platforms, {
            x: this.lastMousePosition.x,
            y: this.lastMousePosition.y,
            direction: direction
        });
        this.showPlatformList = true;
    } else {
        // 更新列表位置
        this.platformListManager.updatePosition(
            this.lastMousePosition.x,
            this.lastMousePosition.y
        );
    }
}
```

#### handleMouseUp 改造
```javascript
handleMouseUp(e) {
    if (this.isDragging) {
        // 检查鼠标是否在某个平台上
        const selectedPlatform = this.platformListManager?.getSelectedPlatform(
            e.clientX,
            e.clientY
        );
        
        if (selectedPlatform) {
            // 执行选中平台的操作
            this.executePlatformAction(selectedPlatform, this.selectedText);
        } else if (this.validateAndExecuteDrag()) {
            // 如果没有选中平台，执行默认操作（向后兼容）
            const direction = TextDragUtils.calculateDirection(
                this.startPosition,
                this.endPosition
            );
            this.executeAction(direction, this.selectedText);
        }
        
        // 清理
        this.platformListManager?.destroy();
        this.resetDragState();
    }
}

executePlatformAction(platform, text) {
    // 1. 构建URL
    const url = platform.url.replace('{query}', encodeURIComponent(text));
    
    // 2. 发送事件
    this.dispatchTextDragEvent({
        url: url,
        title: `${platform.name}: ${text}`
    }, text, 'search', 'platform');
}
```

---

### 5. 配置数据结构

#### 新配置结构
```javascript
{
    textActions: {
        enabled: true,
        
        // 预设平台
        presetPlatforms: {
            google: {
                id: 'google',
                name: 'Google',
                url: 'https://www.google.com/search?q={query}',
                icon: 'data:image/svg+xml,...',
                category: 'search'
            },
            deepseek: {
                id: 'deepseek',
                name: 'DeepSeek',
                url: 'https://www.deepseek.com/search?q={query}',
                icon: 'data:image/svg+xml,...',
                category: 'search'
            },
            // ... 更多预设
        },
        
        // 自定义平台
        customPlatforms: {
            'custom-1': {
                id: 'custom-1',
                name: '自定义搜索',
                url: 'https://example.com/search?q={query}',
                icon: null,
                category: 'custom'
            }
        },
        
        // 方向配置
        directions: {
            up: ['google', 'deepseek', 'wikipedia'],
            down: ['baidu-translate'],
            left: ['google'],
            right: ['baidu']
        },
        
        // UI配置
        listPosition: 'auto',  // 'auto' | 'mouse' | 'direction'
        listStyle: 'vertical',
        showIcons: true,
        animationEnabled: true,
        maxItemsPerDirection: 10
    }
}
```

---

## 📊 关键函数签名

```javascript
// 平台列表管理
class PlatformListManager {
    createList(platforms, position) → void
    updatePosition(x, y) → void
    highlightPlatform(index) → void
    getSelectedPlatform(x, y) → Platform | null
    destroy() → void
}

// 文本拖拽管理器改造
class LinkWindowTextDragManager {
    updatePlatformListDisplay() → void
    executePlatformAction(platform, text) → void
    getPlatformsForDirection(direction) → Platform[]
}

// 工具函数
TextDragUtils.getPlatformById(id) → Platform | null
TextDragUtils.validatePlatformUrl(url) → boolean
TextDragUtils.calculateListPosition(mousePos, direction) → {x, y}
```

---

## 🔄 向后兼容性

**保持兼容**:
- 如果方向没有配置平台，使用原有的单一操作模式
- 原有的 `directions` 配置仍然支持字符串值
- 自动迁移旧配置到新格式

**迁移逻辑**:
```javascript
function migrateConfig(oldConfig) {
    if (typeof oldConfig.directions.up === 'string') {
        // 旧格式: directions.up = 'search'
        // 新格式: directions.up = ['baidu']
        return {
            ...oldConfig,
            directions: {
                up: oldConfig.directions.up === 'search' ? ['baidu'] : [],
                down: oldConfig.directions.down === 'translate' ? ['baidu-translate'] : [],
                // ...
            }
        };
    }
    return oldConfig;
}
```

---

**最后更新**: 2025-10-24

