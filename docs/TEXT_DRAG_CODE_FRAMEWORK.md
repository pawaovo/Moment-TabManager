# 文本拖拽功能升级 - 代码框架和实现细节

**文档版本**: 1.0  
**创建时间**: 2025-10-24  
**用途**: 开发人员参考，提供代码框架和实现细节

---

## 🏗️ 新增类: PlatformListManager

### 文件位置
`content-scripts/platform-list-manager.js`

### 类定义框架

```javascript
class PlatformListManager {
    constructor(config) {
        this.config = config;
        this.listElement = null;
        this.itemElements = new Map();
        this.currentDirection = null;
        this.selectedIndex = -1;
        this.isVisible = false;
    }

    // 创建平台列表
    createList(platforms, position) {
        // 1. 创建容器
        this.listElement = document.createElement('div');
        this.listElement.className = 'moment-platform-list';
        
        // 2. 创建平台项目
        platforms.forEach((platform, index) => {
            const item = this.createPlatformItem(platform, index);
            this.listElement.appendChild(item);
            this.itemElements.set(platform.id, item);
        });
        
        // 3. 设置位置
        this.updatePosition(position.x, position.y);
        
        // 4. 添加到页面
        document.body.appendChild(this.listElement);
        this.isVisible = true;
        
        // 5. 触发显示动画
        requestAnimationFrame(() => {
            this.listElement.classList.add('visible');
        });
    }

    // 创建单个平台项目
    createPlatformItem(platform, index) {
        const item = document.createElement('div');
        item.className = 'moment-platform-item';
        item.dataset.platformId = platform.id;
        item.dataset.index = index;
        
        // 添加图标
        if (platform.icon && this.config.showIcons) {
            const icon = document.createElement('img');
            icon.src = platform.icon;
            icon.className = 'moment-platform-icon';
            item.appendChild(icon);
        }
        
        // 添加名称
        const name = document.createElement('span');
        name.className = 'moment-platform-name';
        name.textContent = platform.name;
        item.appendChild(name);
        
        return item;
    }

    // 更新列表位置
    updatePosition(x, y) {
        if (!this.listElement) return;
        
        // 计算最佳位置
        const pos = this.calculateOptimalPosition(x, y);
        
        // 使用 transform 优化性能
        this.listElement.style.transform = 
            `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    }

    // 计算最优位置
    calculateOptimalPosition(x, y) {
        const rect = this.listElement.getBoundingClientRect();
        let newX = x, newY = y;
        
        // 处理右边界
        if (newX + rect.width > window.innerWidth) {
            newX = window.innerWidth - rect.width - 10;
        }
        
        // 处理下边界
        if (newY + rect.height > window.innerHeight) {
            newY = window.innerHeight - rect.height - 10;
        }
        
        // 处理左边界
        if (newX < 0) newX = 10;
        
        // 处理上边界
        if (newY < 0) newY = 10;
        
        return { x: newX, y: newY };
    }

    // 高亮平台
    highlightPlatform(index) {
        // 移除旧高亮
        this.itemElements.forEach(item => {
            item.classList.remove('highlighted');
        });
        
        // 添加新高亮
        if (index >= 0 && index < this.itemElements.size) {
            const items = Array.from(this.itemElements.values());
            items[index].classList.add('highlighted');
            this.selectedIndex = index;
        }
    }

    // 获取选中平台
    getSelectedPlatform(x, y) {
        if (!this.isVisible) return null;
        
        const rect = this.listElement.getBoundingClientRect();
        
        // 检查鼠标是否在列表范围内
        if (x < rect.left || x > rect.right ||
            y < rect.top || y > rect.bottom) {
            return null;
        }
        
        // 查找鼠标所在的平台项目
        const item = document.elementFromPoint(x, y);
        const platformItem = item?.closest('.moment-platform-item');
        
        if (platformItem) {
            const platformId = platformItem.dataset.platformId;
            return this.config.getPlatformById(platformId);
        }
        
        return null;
    }

    // 销毁列表
    destroy() {
        if (!this.listElement) return;
        
        // 触发隐藏动画
        this.listElement.classList.remove('visible');
        
        // 延迟移除 DOM
        setTimeout(() => {
            if (this.listElement && this.listElement.parentNode) {
                this.listElement.parentNode.removeChild(this.listElement);
            }
            this.listElement = null;
            this.itemElements.clear();
            this.isVisible = false;
        }, 200);
    }
}
```

---

## 🔧 改造 LinkWindowTextDragManager 类

### 新增状态变量

```javascript
class LinkWindowTextDragManager {
    constructor() {
        // 原有状态
        this.isDragging = false;
        this.isPotentialDrag = false;
        this.startPosition = null;
        this.endPosition = null;
        this.lastMousePosition = null;
        this.dragDistance = 0;
        this.selectedText = '';
        
        // 新增状态
        this.showPlatformList = false;
        this.currentDirection = null;
        this.selectedPlatformIndex = -1;
        this.platformListRafId = null;
        this.platformListManager = null;
        this.platformConfig = null;
    }
}
```

### 改造 handleMouseMove 方法

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
```

### 新增 updatePlatformListDisplay 方法

```javascript
updatePlatformListDisplay() {
    // 1. 识别方向
    const direction = TextDragUtils.calculateDirection(
        this.startPosition,
        this.lastMousePosition
    );
    this.currentDirection = direction;
    
    // 2. 获取该方向的平台列表
    const platforms = this.getPlatformsForDirection(direction);
    
    // 3. 如果没有平台，隐藏列表
    if (platforms.length === 0) {
        if (this.platformListManager) {
            this.platformListManager.destroy();
            this.platformListManager = null;
            this.showPlatformList = false;
        }
        return;
    }
    
    // 4. 创建或更新列表
    if (!this.showPlatformList) {
        this.platformListManager = new PlatformListManager(
            this.platformConfig
        );
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
        
        // 检测鼠标悬停的平台
        const selectedPlatform = 
            this.platformListManager.getSelectedPlatform(
                this.lastMousePosition.x,
                this.lastMousePosition.y
            );
        
        if (selectedPlatform) {
            const index = platforms.findIndex(
                p => p.id === selectedPlatform.id
            );
            this.platformListManager.highlightPlatform(index);
        }
    }
}
```

### 改造 handleMouseUp 方法

```javascript
handleMouseUp(e) {
    if (this.isDragging) {
        this.endPosition = { x: e.clientX, y: e.clientY };
        
        // 检查鼠标是否在某个平台上
        const selectedPlatform = 
            this.platformListManager?.getSelectedPlatform(
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
```

### 新增 executePlatformAction 方法

```javascript
executePlatformAction(platform, text) {
    // 1. 构建 URL
    const url = platform.url.replace(
        '{query}',
        encodeURIComponent(text)
    );
    
    // 2. 发送事件
    this.dispatchTextDragEvent({
        url: url,
        title: `${platform.name}: ${text}`
    }, text, 'search', 'platform');
}
```

### 新增 getPlatformsForDirection 方法

```javascript
getPlatformsForDirection(direction) {
    const platformIds = 
        this.platformConfig.directions[direction] || [];
    
    return platformIds
        .map(id => TextDragUtils.getPlatformById(id))
        .filter(p => p !== null && p.enabled);
}
```

### 新增 resetDragState 方法

```javascript
resetDragState() {
    this.isDragging = false;
    this.isPotentialDrag = false;
    this.startPosition = null;
    this.endPosition = null;
    this.lastMousePosition = null;
    this.dragDistance = 0;
    this.selectedText = '';
    this.showPlatformList = false;
    this.currentDirection = null;
    this.selectedPlatformIndex = -1;
    this.platformListManager = null;
    
    if (this.platformListRafId) {
        cancelAnimationFrame(this.platformListRafId);
        this.platformListRafId = null;
    }
}
```

---

## 🎨 CSS 样式框架

### 在 link-preview.css 中添加

```css
/* 平台列表容器 */
.moment-platform-list {
    position: fixed;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    min-width: 150px;
    max-width: 250px;
    
    /* 性能优化 */
    will-change: transform;
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
    
    /* 动画 */
    opacity: 0;
    transition: opacity 0.2s ease;
}

.moment-platform-list.visible {
    opacity: 1;
}

/* 平台项目 */
.moment-platform-item {
    display: flex;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-bottom: 1px solid #f0f0f0;
}

.moment-platform-item:last-child {
    border-bottom: none;
}

.moment-platform-item:hover {
    background-color: #f5f5f5;
}

.moment-platform-item.highlighted {
    background-color: #e3f2fd;
    color: #1976d2;
}

/* 平台图标 */
.moment-platform-icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    border-radius: 2px;
}

/* 平台名称 */
.moment-platform-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
    .moment-platform-list {
        background: #2d2d2d;
        border-color: #444;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }
    
    .moment-platform-item {
        border-bottom-color: #3d3d3d;
    }
    
    .moment-platform-item:hover {
        background-color: #3d3d3d;
    }
    
    .moment-platform-item.highlighted {
        background-color: #1a3a52;
        color: #64b5f6;
    }
    
    .moment-platform-name {
        color: #e0e0e0;
    }
}
```

---

## 📝 工具函数框架

### 在 text-drag-config.js 中添加

```javascript
class TextDragUtils {
    // 获取平台
    static getPlatformById(id) {
        // 从预设平台查找
        if (TEXT_DRAG_CONFIG.PRESET_PLATFORMS[id]) {
            return TEXT_DRAG_CONFIG.PRESET_PLATFORMS[id];
        }
        
        // 从自定义平台查找
        // 需要从 chrome.storage.local 获取
        return null;
    }
    
    // 验证平台 URL
    static validatePlatformUrl(url) {
        try {
            // 检查是否包含 {query} 占位符
            if (!url.includes('{query}')) {
                return false;
            }
            
            // 检查是否是有效的 URL
            const testUrl = url.replace('{query}', 'test');
            new URL(testUrl);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // 计算列表位置
    static calculateListPosition(mouseX, mouseY, direction) {
        let x = mouseX, y = mouseY;
        
        // 根据方向调整
        if (direction === 'up') {
            y -= 150;  // 列表高度估计
        } else if (direction === 'down') {
            y += 10;
        }
        
        // 处理视口边界
        if (x + 250 > window.innerWidth) {
            x = window.innerWidth - 250 - 10;
        }
        if (y < 0) {
            y = 10;
        }
        
        return { x, y };
    }
}
```

---

## 🔄 配置数据结构

### 在 background.js 中添加

```javascript
const DEFAULT_LINK_WINDOW_SETTINGS = {
    textActions: {
        enabled: true,
        
        presetPlatforms: {
            google: {
                id: 'google',
                name: 'Google',
                url: 'https://www.google.com/search?q={query}',
                icon: 'data:image/svg+xml,...',
                category: 'preset',
                enabled: true
            },
            deepseek: {
                id: 'deepseek',
                name: 'DeepSeek',
                url: 'https://www.deepseek.com/search?q={query}',
                icon: 'data:image/svg+xml,...',
                category: 'preset',
                enabled: true
            },
            // ... 更多预设
        },
        
        customPlatforms: {},
        
        directions: {
            up: ['google', 'deepseek'],
            down: ['baidu-translate'],
            left: ['google'],
            right: ['baidu']
        },
        
        listPosition: 'auto',
        listStyle: 'vertical',
        showIcons: true,
        animationEnabled: true,
        maxItemsPerDirection: 10
    }
};
```

---

## 🧪 测试框架

### 单元测试示例

```javascript
describe('PlatformListManager', () => {
    let manager;
    
    beforeEach(() => {
        manager = new PlatformListManager(mockConfig);
    });
    
    test('createList should create DOM elements', () => {
        manager.createList(mockPlatforms, { x: 100, y: 100 });
        expect(manager.listElement).toBeDefined();
        expect(manager.itemElements.size).toBe(mockPlatforms.length);
    });
    
    test('getSelectedPlatform should return correct platform', () => {
        manager.createList(mockPlatforms, { x: 100, y: 100 });
        const platform = manager.getSelectedPlatform(105, 105);
        expect(platform).toBeDefined();
    });
});
```

---

**最后更新**: 2025-10-24

