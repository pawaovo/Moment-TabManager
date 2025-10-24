/**
 * 平台列表管理器
 * 用于管理文本拖拽时显示的平台选择列表UI
 */

class PlatformListManager {
    constructor(config) {
        this.config = config;
        this.listElement = null;
        this.itemElements = new Map();
        this.currentDirection = null;
        this.selectedIndex = -1;
        this.isVisible = false;
        this.rafId = null;
    }

    /**
     * 创建平台列表
     * @param {Array} platforms - 平台数组
     * @param {Object} position - 位置信息 {x, y, direction}
     */
    createList(platforms, position) {
        if (!platforms || platforms.length === 0) return;

        // 1. 创建容器
        this.listElement = document.createElement('div');
        this.listElement.className = 'moment-platform-list';
        this.listElement.setAttribute('data-moment-platform-list', 'true');

        // 2. 创建平台项目
        platforms.forEach((platform, index) => {
            const item = this.createPlatformItem(platform, index);
            this.listElement.appendChild(item);
            this.itemElements.set(platform.id, { element: item, index });
        });

        // 3. 设置初始位置
        this.updatePosition(position.x, position.y);
        this.currentDirection = position.direction;

        // 4. 添加到页面
        document.body.appendChild(this.listElement);
        this.isVisible = true;

        // 5. 触发显示动画
        requestAnimationFrame(() => {
            if (this.listElement) {
                this.listElement.classList.add('visible');
            }
        });

        LinkWindowLogger.drag('平台列表已创建', `平台数: ${platforms.length}`);
    }

    /**
     * 创建单个平台项目
     * @param {Object} platform - 平台对象
     * @param {number} index - 索引
     * @returns {HTMLElement} 平台项目元素
     */
    createPlatformItem(platform, index) {
        const item = document.createElement('div');
        item.className = 'moment-platform-item';
        item.dataset.platformId = platform.id;
        item.dataset.index = index;

        // 添加图标（如果有）
        if (platform.icon && this.config.showIcons) {
            const icon = document.createElement('img');
            icon.src = platform.icon;
            icon.className = 'moment-platform-icon';
            icon.alt = platform.name;
            item.appendChild(icon);
        }

        // 添加名称
        const name = document.createElement('span');
        name.className = 'moment-platform-name';
        name.textContent = platform.name;
        item.appendChild(name);

        return item;
    }

    /**
     * 更新列表位置
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    updatePosition(x, y) {
        if (!this.listElement) return;

        const updateStartTime = performance.now();

        // 计算最优位置
        const pos = this.calculateOptimalPosition(x, y);

        // 使用 transform 优化性能
        this.listElement.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

        const updateDuration = performance.now() - updateStartTime;
        if (updateDuration > 5) {
            LinkWindowLogger.perf('列表位置更新', updateDuration);
        }
    }

    /**
     * 计算最优位置
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object} {x, y} 坐标
     */
    calculateOptimalPosition(x, y) {
        if (!this.listElement) return { x, y };

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

    /**
     * 高亮平台
     * @param {number} index - 平台索引
     */
    highlightPlatform(index) {
        // 移除旧高亮
        this.itemElements.forEach(({ element }) => {
            element.classList.remove('highlighted');
        });

        // 添加新高亮
        if (index >= 0 && index < this.itemElements.size) {
            const items = Array.from(this.itemElements.values());
            if (items[index]) {
                items[index].element.classList.add('highlighted');
                this.selectedIndex = index;
            }
        }
    }

    /**
     * 获取选中平台
     * @param {number} x - 鼠标X坐标
     * @param {number} y - 鼠标Y坐标
     * @returns {Object|null} 平台对象或null
     */
    getSelectedPlatform(x, y) {
        if (!this.isVisible || !this.listElement) return null;

        const rect = this.listElement.getBoundingClientRect();

        // 检查鼠标是否在列表范围内
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            return null;
        }

        // 查找鼠标所在的平台项目
        const item = document.elementFromPoint(x, y);
        const platformItem = item?.closest('.moment-platform-item');

        if (platformItem) {
            const platformId = platformItem.dataset.platformId;
            // 从配置中获取平台信息
            return this.getPlatformInfo(platformId);
        }

        return null;
    }

    /**
     * 获取平台信息（已移至 TextDragUtils.getPlatformById()）
     * 此方法已废弃，请使用 TextDragUtils.getPlatformById() 替代
     * @deprecated 使用 TextDragUtils.getPlatformById() 代替
     */
    getPlatformInfo(platformId) {
        // 委托给 TextDragUtils 以避免代码重复
        return TextDragUtils.getPlatformById(platformId, this.config?.customPlatforms || {});
    }

    /**
     * 销毁列表
     */
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
            this.selectedIndex = -1;
        }, 200);

        LinkWindowLogger.drag('平台列表已销毁');
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlatformListManager;
} else {
    if (typeof window.PlatformListManager === 'undefined') {
        window.PlatformListManager = PlatformListManager;
    }
}

