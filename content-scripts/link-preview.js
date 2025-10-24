/**
 * Moment-LinkWindow Content Script
 * 处理页面中的链接预览和文本拖拽功能
 */

// 统一日志管理器
class LinkWindowLogger {
    static log(type, message, data = null) {
        const prefix = this.getPrefix(type);
        const logMessage = `${prefix} ${message}`;

        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }

    static getPrefix(type) {
        const prefixes = {
            success: '✅',
            config: '🔧',
            memory: '🧠',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            window: '🪟',
            drag: '🖱️'
        };
        return prefixes[type] || 'ℹ️';
    }

    // 简化的静态方法，减少重复代码
    static success(message, data = null) { this.log('success', message, data); }
    static config(message, data = null) { this.log('config', message, data); }
    static memory(message, data = null) { this.log('memory', message, data); }
    static error(message, data = null) { this.log('error', message, data); }
    static warning(message, data = null) { this.log('warning', message, data); }
    static info(message, data = null) { this.log('info', message, data); }
    static window(message, data = null) { this.log('window', message, data); }
    static drag(message, data = null) { this.log('drag', message, data); }

    // 性能监控方法
    static perf(message, duration) {
        const status = duration < 16.67 ? '✅' : duration < 33.33 ? '⚠️' : '❌';
        console.log(`${status} [性能] ${message}: ${duration.toFixed(2)}ms`);
    }
}

// 统一常量定义
const LinkWindowConstants = {
    MOUSE_RANGE_LIMIT: 100,        // 鼠标有效范围限制
    SAVE_DELAY: 300,               // 延迟保存时间(ms)
    MIN_WINDOW_WIDTH: 300,         // 最小窗口宽度
    MIN_WINDOW_HEIGHT: 200,        // 最小窗口高度
    WINDOW_MARGIN: 10,             // 窗口边距
    MAX_WINDOWS: 10,               // 最大窗口数量
    DEFAULT_DELAY: 300,            // 默认延迟时间
    Z_INDEX_BASE: 10000           // z-index基础值
};

// 工具类 - 重构为功能分组的工具类
class LinkWindowUtils {
    // ==================== 环境检测 ====================
    static isChromeApiAvailable() {
        return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
    }

    static isExtensionEnvironment() {
        return this.isChromeApiAvailable();
    }

    // ==================== 日志工具 ====================
    static logError(context, error, ...args) {
        LinkWindowLogger.error(`${context}: ${error}`, args.length > 0 ? args : null);
    }

    static logWarning(context, message, ...args) {
        LinkWindowLogger.warning(`${context}: ${message}`, args.length > 0 ? args : null);
    }

    static logSuccess(context, message, ...args) {
        LinkWindowLogger.success(`${context}: ${message}`, args.length > 0 ? args : null);
    }

    static logInfo(context, message, ...args) {
        LinkWindowLogger.info(`${context}: ${message}`, args.length > 0 ? args : null);
    }

    // ==================== DOM 操作工具 ====================
    static safeRemoveElement(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    }

    static createElement(tag, className = '', attributes = {}) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    }

    static isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    // ==================== URL 处理工具 ====================
    static extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    static formatUrlForDisplay(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + urlObj.pathname;
        } catch {
            return url;
        }
    }

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // ==================== 数学计算工具 ====================
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static getDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ==================== 防抖节流工具 ====================
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Z-Index 层级管理器
class ZIndexManager {
    constructor(baseZIndex = LinkWindowConstants.Z_INDEX_BASE) {
        this.baseZIndex = baseZIndex;
        this.currentMaxZIndex = baseZIndex;
        this.windowZIndexMap = new Map(); // 存储每个窗口的z-index
    }

    // 获取新的z-index
    getNextZIndex() {
        this.currentMaxZIndex += 10;
        return this.currentMaxZIndex;
    }

    // 为窗口分配z-index
    assignZIndex(windowId, parentWindowId = null) {
        let zIndex;
        if (parentWindowId && this.windowZIndexMap.has(parentWindowId)) {
            // 嵌套窗口，比父窗口高10
            const parentZIndex = this.windowZIndexMap.get(parentWindowId);
            zIndex = parentZIndex + 10;
            this.currentMaxZIndex = Math.max(this.currentMaxZIndex, zIndex);
        } else {
            // 顶级窗口
            zIndex = this.getNextZIndex();
        }

        this.windowZIndexMap.set(windowId, zIndex);
        LinkWindowUtils.logInfo('层级管理', `分配z-index ${zIndex} 给窗口 ${windowId}${parentWindowId ? ` (父窗口: ${parentWindowId})` : ''}`);
        return zIndex;
    }

    // 窗口置顶
    bringToFront(windowId) {
        const newZIndex = this.getNextZIndex();
        this.windowZIndexMap.set(windowId, newZIndex);
        return newZIndex;
    }

    // 移除窗口的z-index记录
    removeWindow(windowId) {
        this.windowZIndexMap.delete(windowId);
        LinkWindowUtils.logInfo('层级管理', `移除窗口 ${windowId} 的z-index记录`);
    }

    // 检查窗口是否存在
    hasWindow(windowId) {
        return this.windowZIndexMap.has(windowId);
    }

    // 获取窗口的z-index
    getWindowZIndex(windowId) {
        return this.windowZIndexMap.get(windowId);
    }
}

// 文本拖拽管理器
class LinkWindowTextDragManager {
    constructor() {
        this.config = TextDragUtils.getDefaultConfig();
        this.isDragging = false;
        this.isPotentialDrag = false; // 新增：标记潜在的拖拽状态
        this.startPosition = { x: 0, y: 0 };
        this.endPosition = { x: 0, y: 0 };
        this.selectedText = '';
        this.dragStartTime = 0;
        this.lastMousePosition = { x: 0, y: 0 };
        this.dragDistance = 0; // 🔧 优化：缓存拖拽距离，避免重复计算

        // 新增：平台列表相关状态
        this.showPlatformList = false;
        this.currentDirection = null;
        this.selectedPlatformIndex = -1;
        this.platformListRafId = null;
        this.platformListManager = null;
        this.platformConfig = null;

        this.init();
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        LinkWindowLogger.success('文本拖拽管理器已启用');
    }

    async loadConfig() {
        try {
            if (LinkWindowUtils.isChromeApiAvailable()) {
                const response = await chrome.runtime.sendMessage({ type: 'getSettings' });
                if (response.success && response.settings?.linkPreview?.textActions) {
                    this.config = { ...this.config, ...response.settings.linkPreview.textActions };
                    LinkWindowLogger.config('文本拖拽配置已加载', this.config);
                }
            }
        } catch (error) {
            console.warn('⚠️ 加载文本拖拽配置失败，使用默认配置:', error);
        }

        // 初始化平台配置（确保总是有值）
        this.platformConfig = {
            presetPlatforms: this.config.presetPlatforms || TEXT_DRAG_CONFIG.PRESET_PLATFORMS || {},
            customPlatforms: this.config.customPlatforms || {},
            directions: this.config.directions || {},
            showIcons: this.config.showIcons !== false,
            listPosition: this.config.listPosition || 'auto'
        };
    }

    bindEvents() {
        document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
        document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);
        document.addEventListener('mouseup', this.handleMouseUp.bind(this), true);
    }

    handleMouseDown(e) {
        // 优化：提前返回条件检查，减少嵌套
        if (!this.config?.enabled || e.button !== 0) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (!selectedText || selectedText.length < 1) return;

        if (!TextDragUtils.isClickInSelection(e, selection)) return;

        // 🔧 修复：只记录潜在拖拽状态，不立即设置为拖拽中
        this.initializePotentialDragState(e, selectedText);
        e.preventDefault();
        LinkWindowLogger.drag('准备文本拖拽', selectedText.substring(0, 50));
    }

    handleMouseMove(e) {
        const moveStartTime = performance.now();

        // 优化：始终更新鼠标位置，减少重复代码
        this.lastMousePosition = { x: e.clientX, y: e.clientY };

        // 🔧 修复：检查是否从潜在拖拽转为真正拖拽
        if (this.isPotentialDrag && !this.isDragging) {
            this.dragDistance = TextDragUtils.calculateDistance(this.startPosition, this.lastMousePosition);
            if (this.dragDistance >= TEXT_DRAG_CONFIG.DRAG_THRESHOLD) {
                // 达到拖拽阈值，开始真正的拖拽
                this.isDragging = true;
                this.isPotentialDrag = false;
                LinkWindowLogger.drag('开始真正拖拽', `距离: ${this.dragDistance.toFixed(0)}px`);
            }
        }

        if (this.isDragging) {
            this.endPosition = this.lastMousePosition;
            document.body.style.cursor = 'grabbing';

            // 新增：显示平台列表（使用 requestAnimationFrame 节流）
            if (!this.platformListRafId) {
                this.platformListRafId = requestAnimationFrame(() => {
                    const updateStartTime = performance.now();
                    this.updatePlatformListDisplay();
                    const updateDuration = performance.now() - updateStartTime;
                    LinkWindowLogger.perf('平台列表更新', updateDuration);
                    this.platformListRafId = null;
                });
            }
        }

        const moveDuration = performance.now() - moveStartTime;
        if (moveDuration > 5) {
            LinkWindowLogger.perf('handleMouseMove', moveDuration);
        }
    }

    handleMouseUp(e) {
        // 🔧 修复：只有在真正拖拽时才执行动作
        if (this.isDragging) {
            // 验证拖拽条件并执行动作
            if (this.validateAndExecuteDrag()) {
                // 确保方向已计算（可能 updatePlatformListDisplay 还未执行）
                if (!this.currentDirection) {
                    this.currentDirection = TextDragUtils.calculateDirection(this.startPosition, this.endPosition);
                }

                // 新增：检查是否选中了平台
                const selectedPlatform = this.platformListManager?.getSelectedPlatform(
                    e.clientX,
                    e.clientY
                );

                if (selectedPlatform) {
                    // 执行选中平台的操作
                    this.executePlatformAction(selectedPlatform, this.selectedText);
                } else {
                    // 如果没有选中平台，执行默认操作（向后兼容）
                    this.executeAction(this.currentDirection, this.selectedText);
                }
            }
            // 清理平台列表
            this.platformListManager?.destroy();
            // 重置拖拽状态
            this.resetDragState();
        } else if (this.isPotentialDrag) {
            // 🔧 修复：如果只是点击而没有拖拽，只重置状态，不执行动作
            this.resetDragState(true); // 清除选中文本
            LinkWindowLogger.drag('仅点击，未拖拽，取消操作');
        }
    }

    // 🔧 优化：初始化潜在拖拽状态的辅助方法
    initializePotentialDragState(event, selectedText) {
        this.isPotentialDrag = true;
        this.startPosition = { x: event.clientX, y: event.clientY };
        this.selectedText = selectedText;
        this.dragStartTime = Date.now();
    }

    // 🔧 优化：统一的状态重置方法
    resetDragState(clearText = false) {
        this.isDragging = false;
        this.isPotentialDrag = false;
        this.dragDistance = 0;
        document.body.style.cursor = '';

        // 新增：清理平台列表相关状态
        if (this.platformListRafId) {
            cancelAnimationFrame(this.platformListRafId);
            this.platformListRafId = null;
        }
        this.currentDirection = null;
        this.selectedPlatformIndex = -1;

        if (clearText) {
            this.selectedText = '';
        }
    }

    // 🔧 优化：验证拖拽条件的辅助方法（使用缓存的距离）
    validateAndExecuteDrag() {
        const dragTime = Date.now() - this.dragStartTime;

        if (!TextDragUtils.validateDragConditions(this.dragDistance, dragTime)) {
            LinkWindowLogger.drag('拖拽条件不满足，忽略操作');
            return false;
        }
        return true;
    }

    // 新增：更新平台列表显示
    updatePlatformListDisplay() {
        if (!this.platformConfig) return;

        // 计算当前拖拽方向
        const direction = TextDragUtils.calculateDirection(this.startPosition, this.endPosition);

        // 获取该方向的平台列表
        const platformIds = this.platformConfig.directions[direction] || [];
        if (platformIds.length === 0) {
            // 如果没有配置平台，销毁列表
            this.platformListManager?.destroy();
            return;
        }

        // 获取平台对象
        const platforms = platformIds
            .map(id => TextDragUtils.getPlatformById(id, this.platformConfig.customPlatforms))
            .filter(p => p !== null);

        if (platforms.length === 0) {
            this.platformListManager?.destroy();
            return;
        }

        // 创建或更新平台列表
        if (!this.platformListManager) {
            this.platformListManager = new PlatformListManager(this.platformConfig);
            this.platformListManager.createList(platforms, {
                x: this.endPosition.x,
                y: this.endPosition.y,
                direction: direction
            });
        } else {
            // 更新列表位置
            this.platformListManager.updatePosition(this.endPosition.x, this.endPosition.y);
        }

        this.currentDirection = direction;
    }

    // 新增：执行平台操作（显示链接弹窗）
    executePlatformAction(platform, text) {
        if (!platform || !platform.url) {
            LinkWindowLogger.drag('平台配置无效');
            return;
        }

        try {
            // 替换 {query} 占位符
            const url = platform.url.replace('{query}', encodeURIComponent(text));

            // 构建结果对象
            const result = {
                url: url,
                title: `${platform.name}: ${text.substring(0, 50)}`
            };

            // 分发文本拖拽事件，触发链接弹窗显示
            this.dispatchTextDragEvent(result, text, 'platform', this.currentDirection || 'up');

            LinkWindowLogger.drag(`执行平台操作: ${platform.name}`, `URL: ${url}`);
        } catch (error) {
            console.error('❌ 执行平台操作失败:', error);
        }
    }

    executeAction(direction, text) {
        const directionConfig = this.config.directions[direction];

        // 新增：支持新的数组格式（向后兼容）
        if (Array.isArray(directionConfig) && directionConfig.length > 0) {
            // 新格式：使用第一个平台作为默认操作
            const platformId = directionConfig[0];
            const platform = TextDragUtils.getPlatformById(platformId, this.platformConfig?.customPlatforms);
            if (platform) {
                this.executePlatformAction(platform, text);
                return;
            }
        }

        // 旧格式：字符串类型的动作
        const action = directionConfig;

        // 优化：提前返回，减少嵌套
        if (!TextDragUtils.shouldExecuteAction(action)) {
            LinkWindowLogger.drag(`方向 ${direction} 未配置有效动作`);
            return;
        }

        LinkWindowLogger.drag(`执行动作: ${action} (方向: ${direction}, 文本: "${text}")`);

        try {
            // 优化：使用统一的URL构建方法
            const result = this.buildActionUrl(action, text);
            if (result) {
                this.dispatchTextDragEvent(result, text, action, direction);
                LinkWindowLogger.success(`文本拖拽预览事件已发送: ${result.title}`);
            }
        } catch (error) {
            LinkWindowUtils.logError('执行文本拖拽动作失败', error);
        }
    }

    // 新增：统一的URL构建方法
    buildActionUrl(action, text) {
        const urlBuilders = {
            'search': () => TextDragUtils.buildSearchUrl(text, this.config),
            'translate': () => TextDragUtils.buildTranslateUrl(text, this.config)
        };

        const builder = urlBuilders[action];
        return builder ? builder() : null;
    }

    // 新增：分发文本拖拽事件的方法
    dispatchTextDragEvent(result, text, action, direction) {
        const event = new CustomEvent('textDragPreview', {
            detail: {
                url: result.url,
                title: result.title,
                text,
                action,
                direction,
                position: this.lastMousePosition
            }
        });
        document.dispatchEvent(event);
    }
}

// 加载指示器管理器
class LinkWindowLoadingIndicator {
    constructor() {
        this.indicators = new Map();
        this.indicatorCounter = 0;
    }

    create(options = {}) {
        const { x = 0, y = 0, id = null, zIndex = null } = options;

        const indicatorId = id || `loading-indicator-${++this.indicatorCounter}`;

        const indicator = document.createElement('div');
        indicator.className = 'link-preview-loading-indicator';
        indicator.id = indicatorId;

        const spinner = document.createElement('div');
        spinner.className = 'link-preview-loading-spinner';
        indicator.appendChild(spinner);

        this.updatePosition(indicator, x, y);

        // 设置z-index，确保在嵌套弹窗中正确显示
        if (zIndex !== null) {
            indicator.style.zIndex = zIndex + 1; // 比弹窗高一层
        } else {
            // 使用动态z-index，确保总是在最顶层
            const maxZIndex = this.getMaxZIndex();
            indicator.style.zIndex = maxZIndex + 1;
        }

        document.body.appendChild(indicator);

        this.indicators.set(indicatorId, {
            element: indicator,
            x: x,
            y: y,
            createdAt: Date.now(),
            zIndex: indicator.style.zIndex
        });

        console.log(`🔄 创建加载指示器: ${indicatorId} at (${x}, ${y}) z-index: ${indicator.style.zIndex}`);
        return indicatorId;
    }

    /**
     * 获取当前页面的最大z-index
     * @private
     */
    getMaxZIndex() {
        let maxZIndex = 10000; // 默认基础值

        // 检查所有预览窗口的z-index
        const previewWindows = document.querySelectorAll('.link-preview-window');
        previewWindows.forEach(window => {
            const zIndex = parseInt(window.style.zIndex) || 0;
            if (zIndex > maxZIndex) {
                maxZIndex = zIndex;
            }
        });

        return maxZIndex;
    }

    updatePosition(indicator, x, y) {
        let element;

        if (typeof indicator === 'string') {
            const indicatorData = this.indicators.get(indicator);
            if (!indicatorData) return;
            element = indicatorData.element;
            indicatorData.x = x;
            indicatorData.y = y;
        } else {
            element = indicator;
        }

        const adjustedX = x + 20;
        const adjustedY = y - 15;

        element.style.left = `${adjustedX}px`;
        element.style.top = `${adjustedY}px`;
    }

    destroy(indicatorId) {
        const indicatorData = this.indicators.get(indicatorId);
        if (!indicatorData) return;

        const { element } = indicatorData;

        // 🔧 修复：移除加载指示器的淡出动画，直接移除
        // element.style.transition = 'opacity 0.2s ease-out';
        // element.style.opacity = '0';

        // setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        // }, 200);

        this.indicators.delete(indicatorId);
        console.log(`🗑️ 销毁加载指示器: ${indicatorId}`);
    }

    createFromMouseEvent(event, id = null) {
        return this.create({
            x: event.clientX,
            y: event.clientY,
            id: id
        });
    }

    destroyAll() {
        const indicatorIds = Array.from(this.indicators.keys());
        indicatorIds.forEach(id => this.destroy(id));
    }
}

// 链接预览管理器
class LinkWindowPreviewManager {
    constructor() {
        this.isEnabled = true;
        this.config = this.getDefaultConfig();
        this.previewWindows = new Map();
        this.windowCounter = 0;
        this.customKey = 'Alt';
        this.triggerMethod = 'alt+click';
        this.triggerDelay = 300;

        // 事件处理器（按需创建，避免预分配未使用的处理器）
        this.eventHandlers = new Map();

        // 触发状态管理
        this.hoverTimer = null;
        this.longPressTimer = null;
        this.dragState = {
            isActive: false,
            startTime: 0,
            startX: 0,
            startY: 0,
            currentLink: null,
            indicatorId: null
        };

        // 自定义快捷键+悬停状态管理
        this.hoveredLink = null;
        this.hoveredEvent = null;
        this.isModifierPressed = false;

        // 加载指示器管理
        this.loadingIndicators = new Map();
        this.loadingIndicatorManager = new LinkWindowLoadingIndicator();

        // 用户手动调整记录
        this.userAdjustments = new Map(); // windowId -> {size: boolean, position: boolean}

        // 记忆配置（用于"上次大小"和"上次位置"）
        this.memoryConfig = {
            lastSize: null,
            lastPosition: null
        };

        // 记忆保存防抖定时器
        this.memorySaveTimeout = null;

        // 性能优化常量 - 统一定义
        this.CONSTANTS = LinkWindowConstants;

        // 嵌套弹窗层级管理 - 使用独立的 ZIndexManager 类
        this.zIndexManager = new ZIndexManager(LinkWindowConstants.Z_INDEX_BASE);

        this.init();
    }

    getDefaultConfig() {
        return {
            trigger: {
                method: 'alt+click',
                customKey: 'Alt',
                delay: 300
            },
            window: {
                size: 'medium',
                position: 'center',
                color: '#667eea',
                background: 'default',
                backgroundOpacity: 0.95,
                sizes: {
                    small: { width: 500, height: 600 },
                    medium: { width: 700, height: 800 },
                    large: { width: 900, height: 800 }
                }
            }
        };
    }

    async init() {
        await this.loadConfig();
        this.bindEvents();
        this.loadStyles();
        this.setupMessageListener();
        this.setupTextDragListener();
        this.setupShortcutUpdateListener(); // 🔧 新增：设置快捷键更新监听器

        // 检测是否在跨标签页窗口中（缓存结果）
        this.isCrossTabWindow = this.detectCrossTabWindow();
        if (this.isCrossTabWindow) {
            LinkWindowUtils.logInfo('环境检测', '检测到跨标签页窗口环境');
        }

        LinkWindowLogger.success('链接预览管理器初始化完成');
    }

    /**
     * 检测是否在跨标签页窗口中（优化：缓存URL参数解析）
     */
    detectCrossTabWindow() {
        // 缓存URL参数解析结果，避免重复创建URLSearchParams对象
        if (!this._urlParams) {
            this._urlParams = new URLSearchParams(window.location.search);
        }
        return this._urlParams.has('__moment_linkwindow_cross_tab');
    }

    async loadConfig() {
        try {
            if (LinkWindowUtils.isChromeApiAvailable()) {
                const response = await chrome.runtime.sendMessage({ type: 'getSettings' });
                if (response.success && response.settings?.linkPreview) {
                    const settings = response.settings.linkPreview;
                    
                    if (settings.trigger?.customKey) {
                        this.customKey = settings.trigger.customKey;
                    }
                    if (settings.trigger?.method) {
                        this.triggerMethod = settings.trigger.method;
                    }
                    if (settings.trigger?.delay !== undefined) {
                        this.triggerDelay = settings.trigger.delay;
                    }
                    if (settings.window) {
                        this.config.window = { ...this.config.window, ...settings.window };
                    }

                    // 加载记忆配置
                    if (settings.memory) {
                        this.memoryConfig = settings.memory;
                        LinkWindowLogger.memory('记忆配置已加载', this.memoryConfig);
                    }

                    LinkWindowLogger.config('链接预览配置已加载');
                }
            }
        } catch (error) {
            console.warn('⚠️ 加载链接预览配置失败，使用默认配置:', error);
        }
    }

    bindEvents() {
        // 移除旧的事件监听器
        this.removeEventListeners();

        // 根据触发方式绑定相应的事件
        switch (this.triggerMethod) {
            case 'alt+click':
                this.bindClickEvents();
                break;
            case 'alt+hover':
                this.bindCustomKeyHoverEvents();
                break;
            case 'longpress':
                this.bindLongPressEvents();
                break;
            case 'drag':
                this.bindDragEvents();
                break;
            case 'hover':
                this.bindHoverEvents();
                break;
            default:
                this.bindClickEvents();
        }

        LinkWindowLogger.success(`已绑定触发方式: ${this.triggerMethod}`);
    }

    /**
     * 统一的事件处理器绑定方法
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理器
     * @param {boolean} useCapture - 是否使用捕获阶段
     */
    _bindEventHandler(eventType, handler, useCapture = false) {
        // 移除旧的处理器（如果存在）
        this._removeEventHandler(eventType);

        // 绑定新的处理器
        document.addEventListener(eventType, handler, useCapture);

        // 存储处理器引用以便后续清理
        this.eventHandlers.set(eventType, { handler, useCapture });
    }

    /**
     * 移除特定类型的事件处理器
     * @param {string} eventType - 事件类型
     */
    _removeEventHandler(eventType) {
        const handlerInfo = this.eventHandlers.get(eventType);
        if (handlerInfo) {
            document.removeEventListener(eventType, handlerInfo.handler, handlerInfo.useCapture);
            this.eventHandlers.delete(eventType);
        }
    }

    bindClickEvents() {
        const clickHandler = (e) => {
            // 改进的事件委托机制，支持动态内容和嵌套弹窗
            if (!this.isEnabled) return;

            // 检查是否按下了触发修饰键
            if (!this.isCustomKeyPressed(e)) return;

            // 使用事件委托，查找最近的链接元素
            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            // 检查是否在预览窗口内部
            const previewWindow = e.target.closest('.moment-linkwindow-preview');
            let parentWindowId = null;
            if (previewWindow) {
                parentWindowId = previewWindow.id;
                LinkWindowUtils.logInfo('嵌套弹窗检测', '在预览窗口内检测到链接点击，父窗口ID:', parentWindowId);
            }

            e.preventDefault();
            e.stopPropagation();

            // 根据是否在预览窗口内部或跨标签页窗口中决定创建方式
            if (parentWindowId) {
                this.createNestedPreview(link.href, e, parentWindowId);
            } else {
                // 在跨标签页窗口中或普通页面中创建弹窗
                // createPreview 方法内部会自动判断是否需要创建跨标签页窗口
                this.createPreview(link.href, e);
            }
        };

        this._bindEventHandler('click', clickHandler, true);
    }

    bindHoverEvents() {
        this.mouseOverHandler = (e) => {
            if (!this.isEnabled) return;

            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            this.triggerHoverPreview(link, e, 'hover');
        };

        this.mouseOutHandler = (e) => {
            this.clearHoverState();
        };

        document.addEventListener('mouseover', this.mouseOverHandler, true);
        document.addEventListener('mouseout', this.mouseOutHandler, true);
    }

    bindCustomKeyHoverEvents() {
        // 🔧 修复：先清理旧的事件监听器，避免重复绑定
        this.removeCustomKeyHoverEvents();

        this.mouseOverHandler = (e) => {
            if (!this.isEnabled) return;

            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            this.hoveredLink = link;
            this.hoveredEvent = e;

            // 🔧 修复：检查当前修饰键状态，支持嵌套弹窗环境
            if (this.isModifierPressed || this.isCustomKeyPressed(e)) {
                this.triggerCustomKeyHover();
            }
        };

        this.mouseOutHandler = (e) => {
            this.clearCustomKeyHoverState();
        };

        // 🔧 修复：增强键盘事件处理，支持嵌套弹窗环境
        this.keyDownHandler = (e) => {
            if (this.isCustomKeyPressed(e)) {
                this.isModifierPressed = true;

                // 🔧 修复：立即检查是否有悬停的链接，支持两种操作顺序
                if (this.hoveredLink && this.hoveredEvent) {
                    // 创建包含正确修饰键状态的合成事件
                    const enhancedEvent = this.createEnhancedMouseEvent(this.hoveredEvent, e);
                    this.hoveredEvent = enhancedEvent;
                    this.triggerCustomKeyHover();
                }
            }
        };

        this.keyUpHandler = (e) => {
            // 🔧 修复：更精确的修饰键释放检测
            if (this.isModifierPressed && !this.isCustomKeyPressed(e)) {
                this.isModifierPressed = false;
                this.clearCustomKeyHoverState();
            }
        };

        // 绑定事件监听器
        document.addEventListener('mouseover', this.mouseOverHandler, true);
        document.addEventListener('mouseout', this.mouseOutHandler, true);
        document.addEventListener('keydown', this.keyDownHandler, true);
        document.addEventListener('keyup', this.keyUpHandler, true);
    }

    // 🔧 新增：创建包含正确修饰键状态的增强鼠标事件
    createEnhancedMouseEvent(originalEvent, keyboardEvent) {
        return new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            altKey: keyboardEvent.altKey,
            ctrlKey: keyboardEvent.ctrlKey,
            shiftKey: keyboardEvent.shiftKey,
            metaKey: keyboardEvent.metaKey,
            clientX: originalEvent.clientX,
            clientY: originalEvent.clientY,
            target: originalEvent.target
        });
    }

    // 🔧 新增：清理自定义按键悬停事件监听器
    removeCustomKeyHoverEvents() {
        if (this.mouseOverHandler) {
            document.removeEventListener('mouseover', this.mouseOverHandler, true);
        }
        if (this.mouseOutHandler) {
            document.removeEventListener('mouseout', this.mouseOutHandler, true);
        }
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler, true);
        }
        if (this.keyUpHandler) {
            document.removeEventListener('keyup', this.keyUpHandler, true);
        }
    }

    bindLongPressEvents() {
        this.mouseDownHandler = (e) => {
            if (!this.isEnabled) return;
            if (e.button !== 0) return; // 只处理左键

            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            this.clearLongPressState();

            const delay = this.triggerDelay;
            let indicatorId = null;

            if (delay > 0) {
                indicatorId = this.loadingIndicatorManager.createFromMouseEvent(e, `longpress-${link.href}`);
                this.loadingIndicators.set('longpress', indicatorId);
            }

            this.longPressTimer = setTimeout(() => {
                if (indicatorId) {
                    this.loadingIndicatorManager.destroy(indicatorId);
                    this.loadingIndicators.delete('longpress');
                }

                e.preventDefault();
                e.stopPropagation();

                this.createPreview(link.href, e);
            }, delay);
        };

        this.mouseUpHandler = (e) => {
            this.clearLongPressState();
        };

        this.mouseMoveHandler = (e) => {
            this.clearLongPressState();
        };

        // 使用统一的事件管理机制避免重复绑定
        this._bindEventHandler('mousedown', this.mouseDownHandler, true);
        this._bindEventHandler('mouseup', this.mouseUpHandler, true);
        this._bindEventHandler('mousemove', this.mouseMoveHandler, true);
    }

    bindDragEvents() {
        this.mouseDownHandler = (e) => {
            if (e.button !== 0) return;

            const link = e.target.closest('a[href]');
            if (!link) return;

            this.clearDragState();

            this.dragState.isActive = true;
            this.dragState.startTime = Date.now();
            this.dragState.startX = e.clientX;
            this.dragState.startY = e.clientY;
            this.dragState.currentLink = link;

            const delay = this.triggerDelay;
            if (delay > 0) {
                this.dragState.indicatorId = this.loadingIndicatorManager.createFromMouseEvent(
                    e,
                    `drag-trigger-${link.href}`
                );
                this.loadingIndicators.set('dragTrigger', this.dragState.indicatorId);
            }
        };

        this.mouseMoveHandler = (e) => {
            if (!this.dragState.isActive) return;

            const deltaX = Math.abs(e.clientX - this.dragState.startX);
            const deltaY = Math.abs(e.clientY - this.dragState.startY);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > 10) { // 拖拽阈值
                e.preventDefault();
                e.stopPropagation();

                if (this.dragState.indicatorId) {
                    this.loadingIndicatorManager.destroy(this.dragState.indicatorId);
                    this.loadingIndicators.delete('dragTrigger');
                }

                this.createPreview(this.dragState.currentLink.href, e);
                this.clearDragState();
            }
        };

        this.mouseUpHandler = (e) => {
            this.clearDragState();
        };

        // 使用统一的事件管理机制避免重复绑定
        this._bindEventHandler('mousedown', this.mouseDownHandler, true);
        this._bindEventHandler('mousemove', this.mouseMoveHandler, true);
        this._bindEventHandler('mouseup', this.mouseUpHandler, true);
    }

    // 🔧 优化：快捷键检测逻辑
    isCustomKeyPressed(e) {
        // 对于不需要按键的触发方式，直接返回true
        const noKeyMethods = ['longpress', 'hover', 'drag'];
        if (noKeyMethods.includes(this.triggerMethod)) {
            return true;
        }

        if (!this.customKey) return false;

        // 🔧 优化：使用Map提高查找效率
        const modifierCheckers = new Map([
            ['Alt', () => e.altKey],
            ['Ctrl', () => e.ctrlKey],
            ['Shift', () => e.shiftKey],
            ['Meta', () => e.metaKey]
        ]);

        // 解析并检查快捷键
        const keys = this.customKey.split('+').map(k => k.trim());

        return keys.every(key => {
            const checker = modifierCheckers.get(key);
            if (checker) {
                return checker();
            }
            // 对于非修饰键，在keydown事件中检查
            return e.type !== 'keydown' || e.key.toUpperCase() === key.toUpperCase();
        });
    }



    get isModifierPressed() {
        return this._isModifierPressed || false;
    }

    set isModifierPressed(value) {
        this._isModifierPressed = value;
    }

    triggerHoverPreview(link, event, triggerType) {
        this.clearHoverState();

        const delay = this.triggerDelay;
        let indicatorId = null;

        if (delay > 0) {
            const indicatorPrefix = triggerType === 'custom-hover' ? 'custom-hover' : 'hover';
            indicatorId = this.loadingIndicatorManager.createFromMouseEvent(event, `${indicatorPrefix}-${link.href}`);
            this.loadingIndicators.set('hover', indicatorId);
        }

        this.hoverTimer = setTimeout(() => {
            if (indicatorId) {
                this.loadingIndicatorManager.destroy(indicatorId);
                this.loadingIndicators.delete('hover');
            }

            this.createPreview(link.href, event);

            if (triggerType === 'custom-hover') {
                this.clearCustomKeyHoverState();
            }
        }, delay);
    }

    triggerCustomKeyHover() {
        if (!this.hoveredLink || !this.hoveredEvent) return;
        if (this.hoverTimer) return;

        this.triggerHoverPreview(this.hoveredLink, this.hoveredEvent, 'custom-hover');
    }

    clearHoverState() {
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = null;
        }

        const indicatorId = this.loadingIndicators.get('hover');
        if (indicatorId) {
            this.loadingIndicatorManager.destroy(indicatorId);
            this.loadingIndicators.delete('hover');
        }
    }

    clearCustomKeyHoverState() {
        this.clearHoverState();
        this.hoveredLink = null;
        this.hoveredEvent = null;
    }

    clearLongPressState() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }

        const indicatorId = this.loadingIndicators.get('longpress');
        if (indicatorId) {
            this.loadingIndicatorManager.destroy(indicatorId);
            this.loadingIndicators.delete('longpress');
        }
    }

    clearDragState() {
        if (this.dragState.indicatorId) {
            this.loadingIndicatorManager.destroy(this.dragState.indicatorId);
            this.loadingIndicators.delete('dragTrigger');
        }

        this.dragState = {
            isActive: false,
            startTime: 0,
            startX: 0,
            startY: 0,
            currentLink: null,
            indicatorId: null
        };
    }

    isValidLink(link) {
        const href = link.href;
        return href && !href.startsWith('javascript:') && !href.startsWith('mailto:');
    }

    // 🔧 优化：合并消息监听器，避免重复注册
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'settingsUpdated':
                    this.handleSettingsUpdate(message.settings);
                    break;
                case 'updateShortcutSettings':
                    if (window.linkWindowPreviewManager) {
                        window.linkWindowPreviewManager.handleShortcutUpdate(message.settings);
                    }
                    sendResponse({ success: true });
                    break;
            }
        });
    }

    // 🔧 优化：移除重复的监听器方法
    setupShortcutUpdateListener() {
        // 此方法已合并到setupMessageListener中，保留空实现以兼容现有调用
    }

    async handleSettingsUpdate(newSettings) {
        try {
            // 移除旧的事件监听器
            this.removeEventListeners();

            // 更新配置
            if (newSettings?.linkPreview) {
                const settings = newSettings.linkPreview;

                // 更新触发设置
                const triggerUpdates = [];
                let triggerConfigChanged = false;

                if (settings.trigger?.customKey) {
                    this.customKey = settings.trigger.customKey;
                    triggerUpdates.push(`自定义快捷键: ${this.customKey}`);
                    triggerConfigChanged = true;
                }

                if (settings.trigger?.method) {
                    this.triggerMethod = settings.trigger.method;
                    triggerUpdates.push(`触发方式: ${this.triggerMethod}`);
                    triggerConfigChanged = true;
                }

                if (settings.trigger?.delay !== undefined) {
                    this.triggerDelay = settings.trigger.delay;
                    triggerUpdates.push(`触发延迟: ${this.triggerDelay}`);
                    triggerConfigChanged = true;
                }

                if (triggerUpdates.length > 0) {
                    LinkWindowLogger.config('触发设置已更新', triggerUpdates.join(', '));
                }

                // 如果触发配置发生变化，更新所有iframe中的脚本
                if (triggerConfigChanged) {
                    this.updateIframeConfigs();
                }

                // 更新弹窗设置
                let needsMemoryReload = false;
                const windowUpdates = [];

                if (settings.window) {
                    // 批量更新窗口配置
                    const windowSettings = [
                        { key: 'size', label: '大小' },
                        { key: 'position', label: '位置' },
                        { key: 'color', label: '颜色' },
                        { key: 'backgroundOpacity', label: '背景透明度' },
                        { key: 'background', label: '背景' }
                    ];

                    windowSettings.forEach(({ key, label }) => {
                        if (settings.window[key] !== undefined) {
                            this.config.window[key] = settings.window[key];
                            windowUpdates.push(`${label}: ${settings.window[key]}`);

                            // 检查是否需要重新加载记忆配置
                            if ((key === 'size' && settings.window[key] === 'lastSize') ||
                                (key === 'position' && settings.window[key] === 'lastPosition')) {
                                needsMemoryReload = true;
                            }
                        }
                    });

                    if (windowUpdates.length > 0) {
                        LinkWindowLogger.config('弹窗设置已更新', windowUpdates.join(', '));
                    }
                }

                // 更新其他设置
                const otherUpdates = [];

                if (settings.textActions) {
                    this.config.textActions = { ...this.config.textActions, ...settings.textActions };
                    otherUpdates.push('文本拖拽设置');
                }

                if (settings.memory) {
                    this.memoryConfig = settings.memory;
                    otherUpdates.push(`记忆配置: ${JSON.stringify(settings.memory)}`);
                }

                if (settings.enabled !== undefined) {
                    this.isEnabled = settings.enabled !== false;
                    otherUpdates.push(`链接预览状态: ${this.isEnabled ? '启用' : '禁用'}`);
                }

                if (otherUpdates.length > 0) {
                    LinkWindowLogger.config('其他设置已更新', otherUpdates.join(', '));
                }

                // 只在需要时重新加载完整配置（避免不必要的网络请求）
                if (needsMemoryReload) {
                    await this.reloadConfigFromStorage();
                }
            }

            // 重新绑定事件监听器
            this.bindEvents();

            LinkWindowLogger.success('链接预览设置更新完成');
        } catch (error) {
            console.error('❌ 处理设置更新失败:', error);
        }
    }

    removeEventListeners() {
        // 清除所有定时器和状态
        this.clearHoverState();
        this.clearLongPressState();
        this.clearDragState();
        this.clearCustomKeyHoverState();

        // 🔧 修复：清理自定义按键悬停事件监听器
        this.removeCustomKeyHoverEvents();

        // 统一移除所有事件监听器
        for (const [eventType] of this.eventHandlers) {
            this._removeEventHandler(eventType);
        }

        LinkWindowUtils.logInfo('事件清理', '所有事件监听器已移除');
    }

    setupTextDragListener() {
        document.addEventListener('textDragPreview', (e) => {
            const { url, title, text, action, direction, position } = e.detail;
            console.log('📨 收到文本拖拽预览请求:', { url, title, action, direction });

            this.createPreview(url, {
                clientX: position.x,
                clientY: position.y,
                triggerSource: 'textDrag',
                textAction: {
                    action,
                    text,
                    direction,
                    title
                }
            });
        });
    }

    createPreview(url, triggerEvent = null) {
        // 🪟 统一的跨标签页窗口处理
        if (this.isCrossTabWindow) {
            return this._handleCrossTabWindowPreview(url, triggerEvent, 'main');
        }

        return this._createPreviewInternal(url, triggerEvent, { isNested: false });
    }

    /**
     * 创建嵌套预览窗口
     */
    createNestedPreview(url, triggerEvent, parentWindowId) {
        console.log('🔗 创建嵌套预览窗口:', url, '父窗口ID:', parentWindowId);

        // 🪟 统一的跨标签页窗口处理
        if (this.isCrossTabWindow) {
            return this._handleCrossTabWindowPreview(url, triggerEvent, 'nested');
        }

        return this._createPreviewInternal(url, triggerEvent, {
            isNested: true,
            parentWindowId: parentWindowId
        });
    }

    /**
     * 统一处理跨标签页窗口中的预览创建
     * @private
     */
    _handleCrossTabWindowPreview(url, triggerEvent, type) {
        LinkWindowUtils.logInfo('跨标签页处理', `在跨标签页窗口中创建新的跨标签页窗口 (${type}):`, url);
        return this.createCrossTabPreviewFromCrossTab(url, triggerEvent);
    }

    /**
     * 内部统一的预览窗口创建方法
     * @param {string} url - 要预览的URL
     * @param {Event} triggerEvent - 触发事件
     * @param {Object} options - 创建选项
     * @param {boolean} options.isNested - 是否为嵌套窗口
     * @param {string} options.parentWindowId - 父窗口ID（仅嵌套窗口）
     */
    _createPreviewInternal(url, triggerEvent = null, options = {}) {
        const { isNested = false, parentWindowId = null } = options;

        // 统一的前置检查
        if (!this.isEnabled) return;

        if (this.previewWindows.size >= LinkWindowConstants.MAX_WINDOWS) {
            console.log('⚠️ 已达到最大预览窗口数量限制');
            return;
        }

        // 创建加载指示器（统一处理）
        let loadingIndicatorId = null;
        if (triggerEvent && (triggerEvent.clientX !== undefined && triggerEvent.clientY !== undefined)) {
            const indicatorPrefix = isNested ? 'nested-loading' : 'loading';
            loadingIndicatorId = this.loadingIndicatorManager.create({
                x: triggerEvent.clientX,
                y: triggerEvent.clientY,
                id: `${indicatorPrefix}-${Date.now()}`
            });
            console.log(`🔄 ${isNested ? '嵌套' : '主'}弹窗加载指示器已创建:`, loadingIndicatorId);
        }

        // 生成窗口ID和分配z-index
        const windowId = `preview-${++this.windowCounter}`;
        let zIndex;

        if (isNested && parentWindowId) {
            zIndex = this.zIndexManager.assignZIndex(windowId, parentWindowId);
        } else {
            // 对于跨标签页窗口中的弹窗，确保有足够高的z-index
            zIndex = this.zIndexManager.assignZIndex(windowId);
            if (options.isCrossTabOrigin) {
                // 跨标签页窗口中的弹窗需要更高的z-index以确保显示在页面内容之上
                zIndex += 1000;
                LinkWindowUtils.logInfo('层级管理', `跨标签页窗口弹窗z-index调整为: ${zIndex}`);
            }
        }

        // 准备窗口选项
        const windowOptions = {
            zIndex: zIndex,
            parentWindowId: parentWindowId,
            isNested: isNested,
            loadingIndicatorId: loadingIndicatorId
        };

        // 准备触发事件（统一处理）
        const enhancedTriggerEvent = triggerEvent ? {
            ...triggerEvent,
            nestedOptions: isNested ? windowOptions : undefined,
            loadingIndicatorId: loadingIndicatorId
        } : {
            nestedOptions: isNested ? windowOptions : undefined,
            loadingIndicatorId: loadingIndicatorId
        };

        console.log(`🔗 创建${isNested ? '嵌套' : '主'}链接预览: ${url}`);

        // 创建和配置窗口
        const window = this.createPreviewWindow(windowId, url, enhancedTriggerEvent);
        this.previewWindows.set(windowId, window);
        document.body.appendChild(window);

        this.applyWindowStyles(window, enhancedTriggerEvent);
        this.bindWindowEvents(window);

        // 弹窗创建完成后立即清理触发加载指示器
        // 这是正确的时机：弹窗已出现，触发过程结束
        if (loadingIndicatorId) {
            this.loadingIndicatorManager.destroy(loadingIndicatorId);
            LinkWindowUtils.logInfo('触发完成', `${isNested ? '嵌套' : '主'}弹窗触发加载指示器已清理:`, loadingIndicatorId);
        }

        // 🎯 焦点管理：将焦点转移到新创建的预览窗口
        // 这解决了鼠标焦点停留在原页面导致意外跳转的问题
        this.transferFocusToPreview(window, enhancedTriggerEvent);

        return window;
    }

    createPreviewWindow(windowId, url, triggerEvent = null) {
        const window = document.createElement('div');
        window.id = windowId;
        window.className = 'moment-linkwindow-preview';

        let displayTitle;
        if (triggerEvent && triggerEvent.triggerSource === 'textDrag' && triggerEvent.textAction) {
            displayTitle = triggerEvent.textAction.title;
            // 🎯 修复：移除特殊CSS类，确保与链接弹窗样式一致
            // window.classList.add('text-drag-preview'); // 已移除
        } else {
            const domain = LinkWindowUtils.extractDomain(url);
            displayTitle = domain;
        }

        window.innerHTML = `
            <div class="preview-header">
                <div class="preview-header-left">
                    <div class="preview-url-bar" title="${url}">${url}</div>
                    <div class="preview-title">${displayTitle}</div>
                </div>
                <div class="preview-controls">
                    <button class="preview-pin" title="升级为跨标签页窗口">📌</button>
                    <button class="preview-minimize" title="最小化">➖</button>
                    <button class="preview-close" title="关闭">✕</button>
                </div>
            </div>
            <div class="preview-content">
                <iframe src="${url}" frameborder="0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
            </div>
            <div class="preview-resize-handle" title="拖拽调整大小">⋮⋮</div>
        `;

        return window;
    }

    applyWindowStyles(previewWindow, triggerEvent = null) {
        const windowId = previewWindow.id;
        const userAdjustment = this.userAdjustments.get(windowId) || { size: false, position: false };

        // 应用窗口大小（只有在用户没有手动调整过时才应用）
        if (!userAdjustment.size) {
            const { width, height } = this.getWindowSize();
            Object.assign(previewWindow.style, {
                width: `${width}px`,
                height: `${height}px`
            });
        }

        // 应用窗口位置（只有在用户没有手动调整过时才应用）
        if (!userAdjustment.position) {
            const { width, height } = this.getWindowSize();
            const { left, top } = this.getWindowPosition(width, height, triggerEvent);
            Object.assign(previewWindow.style, {
                left: `${left}px`,
                top: `${top}px`
            });
        }

        // 应用z-index - 支持嵌套窗口层级管理
        let zIndex;
        if (triggerEvent && triggerEvent.nestedOptions && triggerEvent.nestedOptions.zIndex) {
            // 嵌套窗口使用预分配的z-index
            zIndex = triggerEvent.nestedOptions.zIndex;
        } else {
            // 普通窗口使用z-index管理器分配
            zIndex = this.zIndexManager.assignZIndex(previewWindow.id);
        }
        previewWindow.style.zIndex = zIndex;

        this.applyWindowTheme(previewWindow);
    }

    getWindowSize() {
        const size = this.config.window.size;

        // 如果是"上次大小"且有记忆的大小，使用记忆的大小
        if (size === 'lastSize' && this.memoryConfig?.lastSize) {
            console.log('📏 使用记忆的窗口大小:', this.memoryConfig.lastSize);
            return this.memoryConfig.lastSize;
        }

        // 使用预设大小
        const sizes = this.config.window.sizes;
        return sizes[size] || sizes.medium;
    }

    getWindowPosition(width, height, triggerEvent) {
        const position = this.config.window.position;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 如果是"上次位置"且有记忆的位置，使用记忆的位置
        if (position === 'lastPosition' && this.memoryConfig?.lastPosition) {
            const lastPos = this.memoryConfig.lastPosition;
            console.log('📍 使用记忆的窗口位置:', lastPos);
            // 确保位置在视口内
            const left = Math.max(10, Math.min(lastPos.left, viewportWidth - width - 10));
            const top = Math.max(10, Math.min(lastPos.top, viewportHeight - height - 10));
            return { left, top };
        }

        let left, top;

        if (position === 'mouse' && triggerEvent) {
            left = triggerEvent.clientX - width / 2;
            top = triggerEvent.clientY - height / 2;
        } else if (position === 'left') {
            left = 50;
            top = (viewportHeight - height) / 2;
        } else if (position === 'right') {
            left = viewportWidth - width - 50;
            top = (viewportHeight - height) / 2;
        } else { // center
            left = (viewportWidth - width) / 2;
            top = (viewportHeight - height) / 2;
        }

        // 确保窗口在视口内
        left = Math.max(10, Math.min(left, viewportWidth - width - 10));
        top = Math.max(10, Math.min(top, viewportHeight - height - 10));

        return { left, top };
    }

    applyWindowTheme(previewWindow) {
        const color = this.config.window.color;
        const header = previewWindow.querySelector('.preview-header');
        if (header) {
            header.style.background = `linear-gradient(135deg, ${color}, ${color}dd)`;
        }
    }

    // 保存窗口大小到记忆（优化：延迟保存避免频繁操作）
    saveWindowSize(width, height) {
        if (this.memoryConfig) {
            this.memoryConfig.lastSize = { width, height };
            console.log('💾 窗口大小已保存到记忆:', { width, height });
            this.debouncedSaveMemoryConfig();
        }
    }

    // 保存窗口位置到记忆（优化：延迟保存避免频繁操作）
    saveWindowPosition(left, top) {
        if (this.memoryConfig) {
            this.memoryConfig.lastPosition = { left, top };
            console.log('💾 窗口位置已保存到记忆:', { left, top });
            this.debouncedSaveMemoryConfig();
        }
    }

    // 防抖保存记忆配置（优化：避免频繁存储操作）
    debouncedSaveMemoryConfig() {
        if (this.memorySaveTimeout) {
            clearTimeout(this.memorySaveTimeout);
        }
        this.memorySaveTimeout = setTimeout(() => {
            this.saveMemoryConfig();
            this.memorySaveTimeout = null;
        }, 500); // 500ms 防抖延迟
    }

    // 保存记忆配置到存储
    async saveMemoryConfig() {
        try {
            if (LinkWindowUtils.isChromeApiAvailable()) {
                const response = await chrome.runtime.sendMessage({
                    type: 'updateMemoryConfig',
                    memory: this.memoryConfig
                });

                if (response.success) {
                    LinkWindowLogger.success('记忆配置保存成功');
                } else {
                    LinkWindowLogger.error('记忆配置保存失败', response.error);
                }
            }
        } catch (error) {
            console.error('❌ 保存记忆配置异常:', error);
        }
    }

    // 重新从存储中加载完整配置（优化：避免重复代码）
    async reloadConfigFromStorage() {
        try {
            if (LinkWindowUtils.isChromeApiAvailable()) {
                const response = await chrome.runtime.sendMessage({ type: 'getSettings' });
                if (response.success && response.settings?.linkPreview) {
                    const settings = response.settings.linkPreview;

                    // 更新记忆配置
                    if (settings.memory) {
                        this.memoryConfig = settings.memory;
                        console.log('🧠 记忆配置已重新加载:', this.memoryConfig);
                    } else {
                        console.log('📝 存储中没有记忆配置，使用默认值');
                    }

                    // 同时更新其他可能变化的配置
                    if (settings.window) {
                        this.config.window = { ...this.config.window, ...settings.window };
                    }
                } else {
                    console.log('📝 存储中没有配置，使用默认值');
                }
            }
        } catch (error) {
            console.error('❌ 重新加载配置异常:', error);
        }
    }

    bindWindowEvents(previewWindow) {
        const closeBtn = previewWindow.querySelector('.preview-close');
        const pinBtn = previewWindow.querySelector('.preview-pin');
        const minimizeBtn = previewWindow.querySelector('.preview-minimize');
        const header = previewWindow.querySelector('.preview-header');
        const iframe = previewWindow.querySelector('iframe');
        const urlBar = previewWindow.querySelector('.preview-url-bar'); // 🔧 新增：URL展示框元素

        closeBtn.addEventListener('click', () => {
            this.closePreview(previewWindow.id);
        });

        pinBtn.addEventListener('click', () => {
            this.createCrossTabPreview(previewWindow);
        });

        minimizeBtn.addEventListener('click', () => {
            this.toggleMinimize(previewWindow);
        });

        // 🔧 新增：URL展示框的交互逻辑
        if (urlBar) {
            this.setupUrlBarInteraction(urlBar);
        }

        // iframe加载完成后的处理
        const loadHandler = () => {
            // 重新应用主题色，确保在iframe加载完成后主题色仍然生效
            this.applyWindowTheme(previewWindow);

            // 为iframe内部绑定嵌套弹窗事件处理
            this.bindIframeEvents(iframe, previewWindow.id);

            LinkWindowUtils.logSuccess('iframe处理', 'iframe加载完成并已绑定事件');
        };

        iframe.addEventListener('load', loadHandler);

        // iframe加载错误处理
        iframe.addEventListener('error', () => {
            // 在iframe内容区域显示错误信息
            const contentDiv = previewWindow.querySelector('.preview-content');
            if (contentDiv) {
                contentDiv.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #dc3545; font-size: 16px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                        <div>页面加载失败</div>
                    </div>
                `;
            }
            LinkWindowUtils.logError('iframe加载', 'iframe加载失败');
        });

        // 窗口点击置顶功能
        const bringToFrontHandler = () => {
            const windowId = previewWindow.id;
            const newZIndex = this.zIndexManager.bringToFront(windowId);
            previewWindow.style.zIndex = newZIndex;
            LinkWindowUtils.logInfo('窗口置顶', `窗口 ${windowId} 已置顶，新z-index: ${newZIndex}`);
        };
        previewWindow.addEventListener('mousedown', bringToFrontHandler);

        // 绑定拖拽和调整大小功能
        const dragCleanup = this.makeDraggable(previewWindow, header);
        const resizeCleanup = this.makeResizable(previewWindow);

        // 存储清理函数
        previewWindow._eventCleanup = () => {
            if (dragCleanup) dragCleanup();
            if (resizeCleanup) resizeCleanup();
            previewWindow.removeEventListener('mousedown', bringToFrontHandler);

            // 清理iframe的嵌套事件处理
            if (iframe && iframe._nestedEventCleanup) {
                iframe._nestedEventCleanup.forEach(cleanup => cleanup());
                iframe._nestedEventCleanup = [];
            }
        };
    }

    /**
     * 为iframe内部绑定嵌套弹窗事件处理（修复：支持所有触发方式）
     */
    bindIframeEvents(iframe, parentWindowId) {
        try {
            // 检查是否可以访问iframe内容（同源策略）
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                console.log('⚠️ 无法访问iframe内容，可能是跨域限制');
                return;
            }

            console.log('🔗 为iframe绑定嵌套弹窗事件处理，父窗口ID:', parentWindowId, '触发方式:', this.triggerMethod);

            // 🎯 修复：根据用户配置的触发方式绑定相应的事件
            this.bindIframeEventsByTriggerMethod(iframeDoc, parentWindowId, iframe);

            console.log('✅ iframe嵌套事件处理已绑定，触发方式:', this.triggerMethod);

        } catch (error) {
            // 跨域或其他访问限制
            console.log('⚠️ 无法为iframe绑定事件，可能是跨域限制:', error.message);

            // 对于跨域iframe，使用消息传递机制
            this.setupCrossOriginIframeHandler(iframe, parentWindowId);
        }
    }

    /**
     * 根据触发方式为iframe绑定相应的事件
     * @private
     */
    bindIframeEventsByTriggerMethod(iframeDoc, parentWindowId, iframe) {
        // 根据触发方式绑定相应的事件（与主页面逻辑保持一致）
        switch (this.triggerMethod) {
            case 'alt+click':
                this.bindIframeClickEvents(iframeDoc, parentWindowId, iframe);
                break;
            case 'alt+hover':
                this.bindIframeCustomKeyHoverEvents(iframeDoc, parentWindowId, iframe);
                break;
            case 'longpress':
                this.bindIframeLongPressEvents(iframeDoc, parentWindowId, iframe);
                break;
            case 'drag':
                this.bindIframeDragEvents(iframeDoc, parentWindowId, iframe);
                break;
            case 'hover':
                this.bindIframeHoverEvents(iframeDoc, parentWindowId, iframe);
                break;
            default:
                this.bindIframeClickEvents(iframeDoc, parentWindowId, iframe);
        }
    }

    /**
     * 统一的iframe链接触发处理器（参考moment-search的成功实现）
     * @private
     */
    _handleIframeLinkTrigger(e, parentWindowId, triggerType = 'click') {
        if (!this.isEnabled) return false;

        // 安全地获取目标元素
        let target = e.target;

        // 检查target是否为有效的DOM元素
        if (!target || typeof target.closest !== 'function') {
            // 如果target不是元素节点，尝试获取父元素
            if (target && target.parentElement) {
                target = target.parentElement;
            } else {
                console.log('⚠️ iframe事件目标不是有效的DOM元素');
                return false;
            }
        }

        // 尝试查找链接元素
        let link = null;
        try {
            link = target.closest('a[href]');
        } catch (error) {
            console.log('⚠️ 查找链接元素时出错:', error);
            return false;
        }

        if (!link || !this.isValidLink(link)) {
            return false;
        }

        e.preventDefault();
        e.stopPropagation();

        console.log(`🔗 iframe内链接${triggerType}触发:`, link.href);
        this.createNestedPreview(link.href, e, parentWindowId);
        return true;
    }

    /**
     * 创建通用的iframe事件处理器（优化：消除重复代码）
     * @private
     */
    createIframeEventHandler(parentWindowId, actionName, keyCheck = true) {
        return (e) => {
            // 统一的键检查逻辑
            if (keyCheck && !this.isCustomKeyPressed(e)) return;

            // 使用统一的处理器
            this._handleIframeLinkTrigger(e, parentWindowId, actionName);
        };
    }

    /**
     * 为iframe绑定点击事件（Alt+点击触发）
     * @private
     */
    bindIframeClickEvents(iframeDoc, parentWindowId, iframe) {
        const handler = this.createIframeEventHandler(parentWindowId, '点击');
        iframeDoc.addEventListener('click', handler, true);
        this.addIframeEventCleanup(iframe, () => {
            iframeDoc.removeEventListener('click', handler, true);
        });
    }

    /**
     * 为iframe绑定悬停事件（Alt+悬停触发）- 修复：支持两种操作顺序
     * @private
     */
    bindIframeCustomKeyHoverEvents(iframeDoc, parentWindowId, iframe) {
        // 存储iframe的悬停状态
        if (!iframe._hoverState) {
            iframe._hoverState = {
                timer: null,
                loadingIndicatorId: null,
                hoveredLink: null,
                hoveredEvent: null,
                isHovering: false // 新增：跟踪是否正在悬停
            };
        }

        // 🔧 优化：提取修饰键检查逻辑
        const hasModifierKeyPressed = (event, forceCheck = false) => {
            return this.isCustomKeyPressed(event) || this.isModifierPressed || forceCheck;
        };

        // 🔧 优化：简化触发检查逻辑
        const checkAndTriggerHover = (e, link, forceCheck = false) => {
            if (!this.isEnabled || !hasModifierKeyPressed(e, forceCheck) || !link || !this.isValidLink(link)) return;

            // 防止重复触发
            if (iframe._hoverState.hoveredLink === link && iframe._hoverState.timer) return;

            // 更新状态并触发
            this.clearIframeHoverState(iframe);
            iframe._hoverState.hoveredLink = link;
            iframe._hoverState.hoveredEvent = e;

            // 触发悬停预览
            this.triggerIframeHoverPreview(iframe, parentWindowId, 'custom-hover');
        };

        const mouseOverHandler = (e) => {
            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            // 🔧 优化：统一状态记录
            iframe._hoverState.isHovering = true;
            iframe._hoverState.hoveredLink = link;
            iframe._hoverState.hoveredEvent = e;

            // 🔧 优化：使用提取的修饰键检查方法
            if (hasModifierKeyPressed(e)) {
                checkAndTriggerHover(e, link);
            }
        };

        const mouseOutHandler = (e) => {
            // 🔧 优化：智能状态清除逻辑
            iframe._hoverState.isHovering = false;

            // 如果没有按下修饰键，清除所有状态；否则保留链接信息
            if (!this.isModifierPressed) {
                this.clearIframeHoverState(iframe);
            }
        };

        const keyDownHandler = (e) => {
            // 🔧 优化：同步修饰键状态并处理"先悬停后按键"场景
            if (this.isCustomKeyPressed(e)) {
                this.isModifierPressed = true;

                // 如果有悬停的链接，创建合成事件并触发
                if (iframe._hoverState.hoveredLink) {
                    const syntheticEvent = this.createEnhancedMouseEvent(
                        iframe._hoverState.hoveredEvent || e,
                        e
                    );

                    // 设置正确的target
                    Object.defineProperty(syntheticEvent, 'target', {
                        value: iframe._hoverState.hoveredLink,
                        enumerable: true
                    });

                    // 强制触发，因为用户刚按下修饰键
                    checkAndTriggerHover(syntheticEvent, iframe._hoverState.hoveredLink, true);
                }
            }
        };

        const keyUpHandler = (e) => {
            // 🔧 优化：同步修饰键释放状态
            if (this.isModifierPressed && !this.isCustomKeyPressed(e)) {
                this.isModifierPressed = false;
                this.clearIframeHoverState(iframe);
            }
        };

        // 绑定鼠标事件到iframe文档
        iframeDoc.addEventListener('mouseover', mouseOverHandler, true);
        iframeDoc.addEventListener('mouseout', mouseOutHandler, true);

        // 🔧 修复：恢复键盘事件绑定，使用唯一标识避免冲突
        document.addEventListener('keydown', keyDownHandler, true);
        document.addEventListener('keyup', keyUpHandler, true);

        this.addIframeEventCleanup(iframe, () => {
            // 清除悬停状态
            this.clearIframeHoverState(iframe);
            // 移除iframe文档的事件监听器
            iframeDoc.removeEventListener('mouseover', mouseOverHandler, true);
            iframeDoc.removeEventListener('mouseout', mouseOutHandler, true);
            // 移除键盘事件监听器
            document.removeEventListener('keydown', keyDownHandler, true);
            document.removeEventListener('keyup', keyUpHandler, true);
        });
    }

    /**
     * 为iframe绑定长按事件（修复：添加加载指示器支持）
     * @private
     */
    bindIframeLongPressEvents(iframeDoc, parentWindowId, iframe) {
        // 存储iframe的长按状态
        if (!iframe._longPressState) {
            iframe._longPressState = {
                timer: null,
                loadingIndicatorId: null,
                target: null,
                startEvent: null
            };
        }

        const mouseDownHandler = (e) => {
            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            // 清除之前的状态
            this.clearIframeLongPressState(iframe);

            // 记录长按状态
            iframe._longPressState.target = link;
            iframe._longPressState.startEvent = e;

            // 创建加载指示器
            const iframeRect = iframe.getBoundingClientRect();
            const pageX = e.clientX + iframeRect.left + window.scrollX;
            const pageY = e.clientY + iframeRect.top + window.scrollY;

            // 获取父窗口的z-index
            let parentZIndex = null;
            if (parentWindowId && this.zIndexManager.hasWindow(parentWindowId)) {
                parentZIndex = this.zIndexManager.getWindowZIndex(parentWindowId);
            }

            const indicatorId = this.loadingIndicatorManager.create({
                x: pageX,
                y: pageY,
                id: `iframe-longpress-${Date.now()}`,
                zIndex: parentZIndex
            });
            iframe._longPressState.loadingIndicatorId = indicatorId;

            console.log('🔄 iframe内长按开始，创建加载指示器:', indicatorId);

            // 设置长按定时器
            iframe._longPressState.timer = setTimeout(() => {
                // 清除加载指示器
                if (iframe._longPressState.loadingIndicatorId) {
                    this.loadingIndicatorManager.destroy(iframe._longPressState.loadingIndicatorId);
                    iframe._longPressState.loadingIndicatorId = null;
                }

                // 创建嵌套预览
                if (iframe._longPressState.target && iframe._longPressState.startEvent) {
                    console.log('🔗 iframe内检测到链接长按，创建嵌套预览:', iframe._longPressState.target.href);
                    this.createNestedPreview(iframe._longPressState.target.href, iframe._longPressState.startEvent, parentWindowId);
                }

                // 清除状态
                this.clearIframeLongPressState(iframe);
            }, this.triggerDelay);
        };

        const clearLongPress = () => {
            this.clearIframeLongPressState(iframe);
        };

        // 绑定事件
        iframeDoc.addEventListener('mousedown', mouseDownHandler, true);
        iframeDoc.addEventListener('mouseup', clearLongPress, true);
        iframeDoc.addEventListener('mouseleave', clearLongPress, true);

        // 存储清理函数
        this.addIframeEventCleanup(iframe, () => {
            this.clearIframeLongPressState(iframe);
            iframeDoc.removeEventListener('mousedown', mouseDownHandler, true);
            iframeDoc.removeEventListener('mouseup', clearLongPress, true);
            iframeDoc.removeEventListener('mouseleave', clearLongPress, true);
        });
    }

    /**
     * 为iframe绑定纯悬停事件（优化：使用通用处理器）
     * @private
     */
    bindIframeHoverEvents(iframeDoc, parentWindowId, iframe) {
        // 存储iframe的悬停状态
        if (!iframe._hoverState) {
            iframe._hoverState = {
                timer: null,
                loadingIndicatorId: null,
                hoveredLink: null,
                hoveredEvent: null
            };
        }

        const mouseOverHandler = (e) => {
            if (!this.isEnabled) return;

            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            // 清除之前的状态
            this.clearIframeHoverState(iframe);

            // 记录当前悬停状态
            iframe._hoverState.hoveredLink = link;
            iframe._hoverState.hoveredEvent = e;

            // 触发悬停预览（带延迟和加载指示器）
            this.triggerIframeHoverPreview(iframe, parentWindowId, 'hover');
        };

        const mouseOutHandler = (e) => {
            this.clearIframeHoverState(iframe);
        };

        iframeDoc.addEventListener('mouseover', mouseOverHandler, true);
        iframeDoc.addEventListener('mouseout', mouseOutHandler, true);

        this.addIframeEventCleanup(iframe, () => {
            // 清除悬停状态
            this.clearIframeHoverState(iframe);
            // 移除事件监听器
            iframeDoc.removeEventListener('mouseover', mouseOverHandler, true);
            iframeDoc.removeEventListener('mouseout', mouseOutHandler, true);
        });
    }

    /**
     * 为iframe绑定拖拽事件（优化：简化实现）
     * @private
     */
    bindIframeDragEvents(iframeDoc, parentWindowId, iframe) {
        let dragState = null;

        const mouseDownHandler = (e) => {
            const link = e.target.closest('a[href]');
            if (!link || !this.isValidLink(link)) return;

            dragState = {
                link,
                startX: e.clientX,
                startY: e.clientY,
                triggered: false
            };
        };

        const mouseMoveHandler = (e) => {
            if (!dragState || dragState.triggered) return;

            const distance = Math.sqrt(
                Math.pow(e.clientX - dragState.startX, 2) +
                Math.pow(e.clientY - dragState.startY, 2)
            );

            if (distance > 10) {
                dragState.triggered = true;
                console.log('🔗 iframe内检测到链接拖拽，创建嵌套预览:', dragState.link.href);
                this.createNestedPreview(dragState.link.href, e, parentWindowId);
            }
        };

        const mouseUpHandler = () => {
            dragState = null;
        };

        // 绑定事件
        iframeDoc.addEventListener('mousedown', mouseDownHandler, true);
        iframeDoc.addEventListener('mousemove', mouseMoveHandler, true);
        iframeDoc.addEventListener('mouseup', mouseUpHandler, true);

        // 存储清理函数
        this.addIframeEventCleanup(iframe, () => {
            iframeDoc.removeEventListener('mousedown', mouseDownHandler, true);
            iframeDoc.removeEventListener('mousemove', mouseMoveHandler, true);
            iframeDoc.removeEventListener('mouseup', mouseUpHandler, true);
        });
    }

    /**
     * 触发iframe悬停预览（带延迟和加载指示器）
     * @private
     */
    triggerIframeHoverPreview(iframe, parentWindowId, triggerType) {
        const hoverState = iframe._hoverState;
        if (!hoverState || !hoverState.hoveredLink || !hoverState.hoveredEvent) return;

        const delay = this.triggerDelay;
        let indicatorId = null;

        // 如果有延迟，创建加载指示器
        if (delay > 0) {
            // 将iframe内的坐标转换为页面坐标
            const iframeRect = iframe.getBoundingClientRect();
            const pageX = hoverState.hoveredEvent.clientX + iframeRect.left + window.scrollX;
            const pageY = hoverState.hoveredEvent.clientY + iframeRect.top + window.scrollY;

            // 获取父窗口的z-index，确保加载指示器显示在正确的层级
            let parentZIndex = null;
            if (parentWindowId && this.zIndexManager.hasWindow(parentWindowId)) {
                parentZIndex = this.zIndexManager.getWindowZIndex(parentWindowId);
            }

            const indicatorPrefix = triggerType === 'custom-hover' ? 'custom-hover' : 'hover';
            indicatorId = this.loadingIndicatorManager.create({
                x: pageX,
                y: pageY,
                id: `${indicatorPrefix}-iframe-${Date.now()}`,
                zIndex: parentZIndex
            });
            hoverState.loadingIndicatorId = indicatorId;
        }

        // 设置延迟触发
        hoverState.timer = setTimeout(() => {
            // 清除加载指示器
            if (indicatorId) {
                this.loadingIndicatorManager.destroy(indicatorId);
                hoverState.loadingIndicatorId = null;
            }

            // 创建嵌套预览
            if (hoverState.hoveredLink && hoverState.hoveredEvent) {
                this.createNestedPreview(hoverState.hoveredLink.href, hoverState.hoveredEvent, parentWindowId);
            }

            // 清除状态
            this.clearIframeHoverState(iframe);
        }, delay);
    }

    /**
     * 清除iframe悬停状态
     * @private
     */
    clearIframeHoverState(iframe) {
        const hoverState = iframe._hoverState;
        if (!hoverState) return;

        // 清除定时器
        if (hoverState.timer) {
            clearTimeout(hoverState.timer);
            hoverState.timer = null;
        }

        // 清除加载指示器
        if (hoverState.loadingIndicatorId) {
            this.loadingIndicatorManager.destroy(hoverState.loadingIndicatorId);
            hoverState.loadingIndicatorId = null;
        }

        // 清除悬停状态
        hoverState.hoveredLink = null;
        hoverState.hoveredEvent = null;
        // 注意：isHovering 状态由 mouseout 事件直接管理
    }

    /**
     * 清除iframe长按状态
     * @private
     */
    clearIframeLongPressState(iframe) {
        const longPressState = iframe._longPressState;
        if (!longPressState) return;

        // 清除定时器
        if (longPressState.timer) {
            clearTimeout(longPressState.timer);
            longPressState.timer = null;
        }

        // 清除加载指示器
        if (longPressState.loadingIndicatorId) {
            this.loadingIndicatorManager.destroy(longPressState.loadingIndicatorId);
            longPressState.loadingIndicatorId = null;
        }

        // 清除长按状态
        longPressState.target = null;
        longPressState.startEvent = null;
    }

    /**
     * 将鼠标焦点转移到预览窗口
     * @param {HTMLElement} previewWindow - 预览窗口元素
     * @param {Event} triggerEvent - 触发事件
     */
    transferFocusToPreview(previewWindow, triggerEvent = null) {
        try {
            // 1. 保护原链接，防止意外点击
            this.protectOriginalLink(triggerEvent);

            // 2. 获取预览窗口的中心位置
            const rect = previewWindow.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // 3. 添加焦点样式
            previewWindow.classList.add('focused');

            // 4. 设置预览窗口为可聚焦并聚焦
            previewWindow.tabIndex = -1; // 使div可聚焦
            previewWindow.focus();

            // 5. 处理iframe焦点
            const iframe = previewWindow.querySelector('iframe');
            if (iframe) {
                // 等待iframe加载完成后尝试聚焦
                iframe.addEventListener('load', () => {
                    try {
                        // 延迟聚焦，确保iframe完全加载
                        setTimeout(() => {
                            iframe.focus();
                        }, 100);
                    } catch (e) {
                        console.log('iframe聚焦失败，保持容器焦点');
                    }
                }, { once: true });
            }

            // 6. 添加焦点丢失监听器
            previewWindow.addEventListener('blur', () => {
                previewWindow.classList.remove('focused');
            }, { once: true });

            // 7. 设置定时器，一段时间后恢复原链接的交互性
            setTimeout(() => {
                this.restoreOriginalLink(triggerEvent);
            }, 2000); // 2秒后恢复


        } catch (error) {
            console.error('❌ 焦点转移失败:', error);
        }
    }

    /**
     * 保护原链接，防止意外点击
     * @param {Event} triggerEvent - 触发事件
     */
    protectOriginalLink(triggerEvent) {
        if (!triggerEvent || !triggerEvent.target) return;

        const originalLink = triggerEvent.target.closest('a[href]');
        if (originalLink) {
            originalLink.classList.add('moment-linkwindow-preview-active-link');
            originalLink.dataset.momentLinkWindowProtected = 'true';

            // 添加临时点击拦截器
            const clickInterceptor = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🛡️ 拦截了对原链接的意外点击');
            };

            originalLink.addEventListener('click', clickInterceptor, { capture: true });
            originalLink.dataset.momentLinkWindowInterceptor = 'attached';
        }
    }

    /**
     * 恢复原链接的交互性
     * @param {Event} triggerEvent - 触发事件
     */
    restoreOriginalLink(triggerEvent) {
        if (!triggerEvent || !triggerEvent.target) return;

        const originalLink = triggerEvent.target.closest('a[href]');
        if (originalLink && originalLink.dataset.momentLinkWindowProtected === 'true') {
            originalLink.classList.remove('moment-linkwindow-preview-active-link');
            delete originalLink.dataset.momentLinkWindowProtected;

            // 移除点击拦截器（通过克隆节点的方式移除所有事件监听器）
            if (originalLink.dataset.momentLinkWindowInterceptor === 'attached') {
                const newLink = originalLink.cloneNode(true);
                originalLink.parentNode.replaceChild(newLink, originalLink);
                console.log('🔓 已恢复原链接的交互性');
            }
        }
    }

    /**
     * 添加iframe事件清理函数
     * @private
     */
    addIframeEventCleanup(iframe, cleanupFn) {
        if (!iframe._nestedEventCleanup) {
            iframe._nestedEventCleanup = [];
        }
        iframe._nestedEventCleanup.push(() => {
            try {
                cleanupFn();
            } catch (error) {
                // 忽略清理时的错误
            }
        });
    }

    /**
     * 设置跨域iframe的消息处理机制
     */
    setupCrossOriginIframeHandler(iframe, parentWindowId) {
        console.log('🌐 设置跨域iframe消息处理机制');

        // 监听来自iframe的消息
        const messageHandler = (event) => {
            // 检查消息来源
            if (event.source !== iframe.contentWindow) return;

            // 处理链接点击消息
            if (event.data && event.data.type === 'momentLinkWindowLinkClick') {
                const { url, triggerPosition } = event.data;
                console.log('📨 收到iframe链接点击消息:', url);

                // 创建模拟的触发事件，包含位置信息以支持加载指示器
                const simulatedTriggerEvent = triggerPosition ? {
                    clientX: triggerPosition.x,
                    clientY: triggerPosition.y,
                    type: 'nested-trigger',
                    timestamp: Date.now()
                } : null;

                // 创建嵌套预览窗口
                this.createNestedPreview(url, simulatedTriggerEvent, parentWindowId);
            }

            // 🔧 新增：处理文字拖拽消息
            else if (event.data && event.data.type === 'momentLinkWindowTextDrag') {
                const { textDragData } = event.data;
                console.log('📨 收到iframe文字拖拽消息:', textDragData);

                // 使用主页面的文字拖拽管理器处理
                if (window.linkWindowTextDragManager) {
                    this.handleIframeTextDrag(textDragData, parentWindowId);
                } else {
                    console.warn('⚠️ 主页面文字拖拽管理器未初始化');
                }
            }
        };

        window.addEventListener('message', messageHandler);

        // 存储清理函数
        if (!iframe._nestedEventCleanup) {
            iframe._nestedEventCleanup = [];
        }
        iframe._nestedEventCleanup.push(() => {
            window.removeEventListener('message', messageHandler);
        });

        // 使用 background script 注入脚本到所有 frame
        this.injectIframeScriptViaBackground(iframe, parentWindowId);
    }

    /**
     * 处理来自iframe的文字拖拽消息
     * @param {Object} textDragData - 文字拖拽数据
     * @param {string} parentWindowId - 父窗口ID
     */
    handleIframeTextDrag(textDragData, parentWindowId) {
        const { text, direction, position } = textDragData;

        console.log('🔧 处理iframe文字拖拽:', { text: text.substring(0, 50), direction });

        // 获取主页面文字拖拽管理器的配置
        const textDragManager = window.linkWindowTextDragManager;
        if (!textDragManager || !textDragManager.config) {
            console.warn('⚠️ 文字拖拽管理器配置不可用');
            return;
        }

        // 根据方向获取对应的动作
        const action = textDragManager.config.directions[direction];
        if (!action || !TextDragUtils.shouldExecuteAction(action)) {
            console.log(`⚠️ 方向 ${direction} 未配置有效动作`);
            return;
        }

        console.log(`🚀 iframe文字拖拽执行动作: ${action} (方向: ${direction})`);

        try {
            // 🔧 优化：复用主页面的URL构建逻辑
            const result = textDragManager.buildActionUrl(action, text);
            if (!result) {
                console.warn(`⚠️ 无法构建${action}动作的URL`);
                return;
            }

            // 🔧 优化：简化事件对象创建
            const simulatedTriggerEvent = {
                clientX: position.x || 0,
                clientY: position.y || 0,
                triggerSource: 'iframeTextDrag',
                textAction: { action, text, direction, title: result.title }
            };

            this.createNestedPreview(result.url, simulatedTriggerEvent, parentWindowId);
            console.log('✅ iframe文字拖拽预览窗口已创建:', result.title);
        } catch (error) {
            console.error('❌ 处理iframe文字拖拽失败:', error);
        }
    }

    /**
     * 通过 background script 注入 iframe 脚本
     */
    injectIframeScriptViaBackground(iframe, parentWindowId) {
        try {
            // 检查是否在扩展环境中
            if (!LinkWindowUtils.isExtensionEnvironment()) {
                LinkWindowUtils.logWarning('脚本注入', '非扩展环境，无法使用 background script 注入');
                return;
            }

            // 获取iframe的URL
            const iframeUrl = iframe.src;
            if (!iframeUrl) {
                LinkWindowUtils.logWarning('脚本注入', 'iframe没有src属性，无法注入脚本');
                return;
            }

            // 获取当前的触发配置
            const triggerConfig = this.getTriggerConfig();

            LinkWindowUtils.logInfo('脚本注入', '请求 background script 注入iframe脚本:', iframeUrl);

            // 向background script发送消息，请求注入脚本
            chrome.runtime.sendMessage({
                type: 'injectIframeScript',
                data: {
                    url: iframeUrl,
                    parentWindowId: parentWindowId,
                    triggerConfig: triggerConfig,
                    delay: this.triggerDelay || LinkWindowConstants.DEFAULT_DELAY
                }
            }, (response) => {
                if (response && response.success) {
                    LinkWindowUtils.logSuccess('脚本注入', 'iframe脚本注入成功');
                } else {
                    LinkWindowUtils.logError('脚本注入', 'iframe脚本注入失败:', response?.error || 'Unknown error');
                }
            });

        } catch (error) {
            LinkWindowUtils.logError('脚本注入', 'background script 注入失败:', error.message);
        }
    }

    /**
     * 获取当前的触发配置
     */
    getTriggerConfig() {
        // 构建修饰键检查表达式
        let checkExpression = 'false';
        switch (this.customKey) {
            case 'Alt':
                checkExpression = 'event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey';
                break;
            case 'Ctrl':
                checkExpression = 'event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey';
                break;
            case 'Shift':
                checkExpression = 'event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey';
                break;
            case 'Meta':
                checkExpression = 'event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey';
                break;
            default:
                checkExpression = 'event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey';
        }

        return {
            method: this.triggerMethod || 'alt+click',
            key: this.customKey || 'Alt',
            checkExpression: checkExpression
        };
    }

    /**
     * 更新所有iframe中的触发配置
     */
    updateIframeConfigs() {
        console.log('🔄 开始更新所有iframe的触发配置');

        // 获取当前页面中所有的预览窗口
        const previewWindows = document.querySelectorAll('.moment-linkwindow-preview');
        let hasActiveIframes = false;

        // 获取一次触发配置，避免重复调用
        const newTriggerConfig = this.getTriggerConfig();
        const delay = this.triggerDelay || 300;

        // 首先尝试通过postMessage更新现有iframe
        previewWindows.forEach(previewWindow => {
            const iframe = previewWindow.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    // 向iframe发送配置更新消息
                    iframe.contentWindow.postMessage({
                        type: 'momentLinkWindowConfigUpdate',
                        triggerConfig: newTriggerConfig,
                        delay: delay,
                        timestamp: Date.now()
                    }, '*');

                    hasActiveIframes = true;
                    console.log('📨 已向iframe发送配置更新消息:', previewWindow.id);
                } catch (error) {
                    console.log('⚠️ 无法向iframe发送配置更新消息:', error.message);
                }
            }
        });

        // 只有在有活跃iframe时才进行background script重新注入
        // 传递已获取的配置，避免重复调用
        if (hasActiveIframes) {
            this.reinjectIframeScripts(newTriggerConfig, delay);
        } else {
            console.log('📝 没有活跃的iframe，跳过重新注入');
        }
    }

    /**
     * 重新注入iframe脚本到所有frame
     * @param {Object} triggerConfig - 可选的预获取触发配置，避免重复调用
     * @param {number} delay - 可选的预获取延迟值
     */
    reinjectIframeScripts(triggerConfig = null, delay = null) {
        try {
            if (!LinkWindowUtils.isExtensionEnvironment()) {
                LinkWindowUtils.logWarning('脚本重注入', '非扩展环境，无法重新注入iframe脚本');
                return;
            }

            // 使用传入的配置或获取新配置
            const config = triggerConfig || this.getTriggerConfig();
            const delayValue = delay !== null ? delay : (this.triggerDelay || LinkWindowConstants.DEFAULT_DELAY);

            LinkWindowUtils.logInfo('脚本重注入', '请求background script重新注入iframe脚本');

            // 向background script发送重新注入请求
            chrome.runtime.sendMessage({
                type: 'reinjectAllIframeScripts',
                data: {
                    triggerConfig: config,
                    delay: delayValue
                }
            }, (response) => {
                if (response && response.success) {
                    LinkWindowUtils.logSuccess('脚本重注入', 'iframe脚本重新注入成功');
                } else {
                    LinkWindowUtils.logError('脚本重注入', 'iframe脚本重新注入失败:', response?.error || 'Unknown error');
                }
            });

        } catch (error) {
            LinkWindowUtils.logError('脚本重注入', '重新注入iframe脚本失败:', error.message);
        }
    }

    async createCrossTabPreview(previewWindow) {
        try {
            const iframe = previewWindow.querySelector('iframe');
            const url = iframe.src;
            const rect = previewWindow.getBoundingClientRect();

            const response = await chrome.runtime.sendMessage({
                type: 'createCrossTabPreview',
                data: {
                    url,
                    options: {
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        left: Math.round(rect.left),
                        top: Math.round(rect.top)
                    }
                }
            });

            if (response.success) {
                this.closePreview(previewWindow.id);
                LinkWindowLogger.window('成功升级为跨标签页窗口', response.windowId);
            }
        } catch (error) {
            console.error('❌ 升级为跨标签页窗口失败:', error);
        }
    }

    /**
     * 在跨标签页窗口中创建新的跨标签页窗口
     * 这确保了真正的独立性，不受父窗口限制
     */
    async createCrossTabPreviewFromCrossTab(url, triggerEvent = null) {
        try {
            if (!LinkWindowUtils.isExtensionEnvironment()) {
                LinkWindowUtils.logWarning('跨标签页创建', '非扩展环境，无法创建跨标签页窗口');
                return;
            }

            // 计算新窗口位置和尺寸，继承当前窗口尺寸
            const options = this.calculateCrossTabWindowPosition(triggerEvent);

            LinkWindowUtils.logInfo('跨标签页创建', '从跨标签页窗口创建新窗口:', url);

            const response = await chrome.runtime.sendMessage({
                type: 'createCrossTabPreview',
                data: {
                    url,
                    options: options
                }
            });

            if (response.success) {
                LinkWindowUtils.logSuccess('跨标签页创建', '成功创建新的跨标签页窗口:', response.windowId);

                // 清理触发加载指示器（如果有）
                if (triggerEvent && triggerEvent.loadingIndicatorId) {
                    this.loadingIndicatorManager.destroy(triggerEvent.loadingIndicatorId);
                    LinkWindowUtils.logInfo('触发完成', '跨标签页窗口触发加载指示器已清理:', triggerEvent.loadingIndicatorId);
                }
            } else {
                LinkWindowUtils.logError('跨标签页创建', '创建跨标签页窗口失败:', response.error);
            }

            return response;
        } catch (error) {
            LinkWindowUtils.logError('跨标签页创建', '创建跨标签页窗口异常:', error.message);
        }
    }

    /**
     * 计算跨标签页窗口的尺寸和位置配置
     * 优化：合并尺寸继承和位置计算逻辑，减少重复计算
     */
    calculateCrossTabWindowPosition(triggerEvent = null) {
        // 获取当前窗口尺寸（继承给新窗口）
        const windowSize = this._getCurrentWindowSize();

        // 计算新窗口位置
        const position = this._calculateNewWindowPosition(triggerEvent, windowSize);

        const windowOptions = {
            width: windowSize.width,
            height: windowSize.height,
            left: position.left,
            top: position.top
        };

        LinkWindowUtils.logInfo('窗口配置', `新窗口配置: 尺寸=${windowOptions.width}x${windowOptions.height}, 位置=(${windowOptions.left}, ${windowOptions.top})`);

        return windowOptions;
    }

    /**
     * 获取当前窗口尺寸
     * @private
     */
    _getCurrentWindowSize() {
        const width = window.outerWidth || 800;
        const height = window.outerHeight || 600;

        LinkWindowUtils.logInfo('尺寸继承', `继承当前窗口尺寸: ${width}x${height}`);

        return { width, height };
    }

    /**
     * 计算新窗口位置，确保不超出屏幕边界
     * @private
     */
    _calculateNewWindowPosition(triggerEvent, windowSize) {
        const { width, height } = windowSize;
        const margin = 50;

        // 计算屏幕边界限制
        const maxLeft = screen.width - width - margin;
        const maxTop = screen.height - height - margin;

        let left, top;

        if (triggerEvent && triggerEvent.clientX !== undefined && triggerEvent.clientY !== undefined) {
            // 基于点击位置计算
            const screenX = window.screenX + triggerEvent.clientX;
            const screenY = window.screenY + triggerEvent.clientY;

            left = Math.min(Math.max(screenX - 100, margin), maxLeft);
            top = Math.min(Math.max(screenY - 50, margin), maxTop);

            LinkWindowUtils.logInfo('位置计算', `基于点击位置计算: (${left}, ${top})`);
        } else {
            // 基于当前窗口位置偏移
            left = Math.min(window.screenX + margin, maxLeft);
            top = Math.min(window.screenY + margin, maxTop);

            LinkWindowUtils.logInfo('位置计算', `基于窗口偏移计算: (${left}, ${top})`);
        }

        return { left, top };
    }

    // 🔧 优化：最小化切换逻辑
    toggleMinimize(previewWindow) {
        const content = previewWindow.querySelector('.preview-content');
        const resizeHandle = previewWindow.querySelector('.preview-resize-handle');
        const isMinimized = previewWindow.classList.contains('minimized');

        if (isMinimized) {
            // 恢复窗口
            previewWindow.classList.remove('minimized');
            content.style.display = 'block';
            if (resizeHandle) resizeHandle.style.display = 'block';

            LinkWindowUtils.logInfo('最小化', '弹窗已恢复显示');
        } else {
            // 最小化窗口
            previewWindow.classList.add('minimized');
            content.style.display = 'none';
            if (resizeHandle) resizeHandle.style.display = 'none';

            LinkWindowUtils.logInfo('最小化', '弹窗已最小化');
        }
    }

    makeDraggable(previewWindow, handle) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        let animationFrameId = null;
        let pendingUpdate = false;
        let currentMouseX, currentMouseY;
        let globalEventsAttached = false;

        // 清理拖拽状态
        const cleanupDragState = () => {
            // 重置状态变量
            isDragging = false;
            pendingUpdate = false;

            // 清理动画帧
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 移除样式
            previewWindow.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // 移除全局事件监听器
            if (globalEventsAttached) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                globalEventsAttached = false;
            }
        };

        const onMouseDown = (e) => {
            // 🔧 修复：排除URL展示框和控制按钮区域的拖拽事件
            if (e.target.closest('.preview-controls') || e.target.closest('.preview-url-bar')) return;

            // 清理任何残留状态
            cleanupDragState();

            // 初始化拖拽状态
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = parseInt(previewWindow.style.left) || 0;
            startTop = parseInt(previewWindow.style.top) || 0;
            currentMouseX = e.clientX;
            currentMouseY = e.clientY;

            // 添加拖拽样式
            previewWindow.classList.add('dragging');
            document.body.style.cursor = 'move';
            document.body.style.userSelect = 'none';

            // 绑定全局事件监听器
            document.addEventListener('mousemove', onMouseMove, { passive: false });
            document.addEventListener('mouseup', onMouseUp, { passive: false });
            globalEventsAttached = true;



            e.preventDefault();
            e.stopPropagation();
        };

        const updatePosition = () => {
            if (!isDragging || !pendingUpdate) return;

            const deltaX = currentMouseX - startX;
            const deltaY = currentMouseY - startY;

            const left = startLeft + deltaX;
            const top = startTop + deltaY;

            // 限制在视口内
            const maxLeft = window.innerWidth - previewWindow.offsetWidth;
            const maxTop = window.innerHeight - previewWindow.offsetHeight;

            const finalLeft = Math.max(0, Math.min(left, maxLeft));
            const finalTop = Math.max(0, Math.min(top, maxTop));

            previewWindow.style.left = `${finalLeft}px`;
            previewWindow.style.top = `${finalTop}px`;

            pendingUpdate = false;
            animationFrameId = null;
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;

            currentMouseX = e.clientX;
            currentMouseY = e.clientY;

            // 使用 requestAnimationFrame 优化渲染性能
            if (!pendingUpdate) {
                pendingUpdate = true;
                animationFrameId = requestAnimationFrame(updatePosition);
            }

            e.preventDefault();
        };

        const onMouseUp = (e) => {
            if (!isDragging) return;

            // 标记为用户手动调整位置
            const windowId = previewWindow.id;
            const userAdjustment = this.userAdjustments.get(windowId) || { size: false, position: false };
            userAdjustment.position = true;
            this.userAdjustments.set(windowId, userAdjustment);

            // 保存位置到记忆
            const left = parseInt(previewWindow.style.left);
            const top = parseInt(previewWindow.style.top);
            this.saveWindowPosition(left, top);

            LinkWindowLogger.drag(`拖拽窗口完成: ${previewWindow.id}`, `位置: (${left}, ${top})`);
            cleanupDragState();
            e.preventDefault();
        };

        handle.addEventListener('mousedown', onMouseDown, { passive: false });

        // 返回清理函数
        return () => {
            handle.removeEventListener('mousedown', onMouseDown);
            cleanupDragState();
        };
    }

    /**
     * 共享的鼠标范围限制方法
     */
    limitMouseRange(mouseX, mouseY, handle, direction, maxDistance = LinkWindowConstants.MOUSE_RANGE_LIMIT) {
        const handleRect = handle.getBoundingClientRect();
        const distanceX = Math.abs(mouseX - (handleRect.left + handleRect.width / 2));
        const distanceY = Math.abs(mouseY - (handleRect.top + handleRect.height / 2));

        if (distanceX > maxDistance || distanceY > maxDistance) {
            const elementRect = handle.closest('.moment-linkwindow-preview').getBoundingClientRect();
            if (direction === 'se') {
                return {
                    x: Math.min(mouseX, elementRect.right + maxDistance),
                    y: Math.min(mouseY, elementRect.bottom + maxDistance)
                };
            }
        }
        return { x: mouseX, y: mouseY };
    }

    makeResizable(previewWindow) {
        const resizeHandle = previewWindow.querySelector('.preview-resize-handle');
        if (!resizeHandle) {
            console.warn('⚠️ 未找到调整大小手柄');
            return () => {};
        }

        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        let animationFrameId = null;
        let pendingUpdate = false;
        let currentMouseX, currentMouseY;
        let globalEventsAttached = false;
        let saveTimeout = null;

        // 清理调整大小状态
        const cleanupResizeState = () => {
            // 重置状态变量
            isResizing = false;
            pendingUpdate = false;

            // 清理动画帧
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            // 清理保存定时器
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }

            // 移除样式
            previewWindow.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // 移除全局事件监听器
            if (globalEventsAttached) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                globalEventsAttached = false;
            }
        };

        const onMouseDown = (e) => {
            // 清理任何残留状态
            cleanupResizeState();

            // 初始化调整大小状态
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(previewWindow.style.width) || previewWindow.offsetWidth;
            startHeight = parseInt(previewWindow.style.height) || previewWindow.offsetHeight;

            // 添加调整大小样式类
            previewWindow.classList.add('resizing');
            document.body.style.cursor = 'se-resize';
            document.body.style.userSelect = 'none';

            // 绑定全局事件监听器
            document.addEventListener('mousemove', onMouseMove, { passive: false });
            document.addEventListener('mouseup', onMouseUp, { passive: false });
            globalEventsAttached = true;



            e.preventDefault();
            e.stopPropagation();
        };

        const updateSize = () => {
            if (!isResizing || !pendingUpdate) return;

            const deltaX = currentMouseX - startX;
            const deltaY = currentMouseY - startY;

            const newWidth = Math.max(LinkWindowConstants.MIN_WINDOW_WIDTH, startWidth + deltaX);
            const newHeight = Math.max(LinkWindowConstants.MIN_WINDOW_HEIGHT, startHeight + deltaY);

            // 限制在视口内
            const windowLeft = parseInt(previewWindow.style.left) || 0;
            const windowTop = parseInt(previewWindow.style.top) || 0;
            const maxWidth = window.innerWidth - windowLeft - LinkWindowConstants.WINDOW_MARGIN;
            const maxHeight = window.innerHeight - windowTop - LinkWindowConstants.WINDOW_MARGIN;

            const finalWidth = Math.min(newWidth, maxWidth);
            const finalHeight = Math.min(newHeight, maxHeight);

            previewWindow.style.width = `${finalWidth}px`;
            previewWindow.style.height = `${finalHeight}px`;

            pendingUpdate = false;
            animationFrameId = null;
        };

        const onMouseMove = (e) => {
            if (!isResizing) return;

            // 使用共享的范围限制方法
            const limitedMouse = this.limitMouseRange(e.clientX, e.clientY, resizeHandle, 'se');
            currentMouseX = limitedMouse.x;
            currentMouseY = limitedMouse.y;

            // 使用 requestAnimationFrame 优化渲染性能
            if (!pendingUpdate) {
                pendingUpdate = true;
                animationFrameId = requestAnimationFrame(updateSize);
            }

            e.preventDefault();
        };

        const onMouseUp = (e) => {
            if (!isResizing) return;

            // 标记为用户手动调整大小
            const windowId = previewWindow.id;
            const userAdjustment = this.userAdjustments.get(windowId) || { size: false, position: false };
            userAdjustment.size = true;
            this.userAdjustments.set(windowId, userAdjustment);

            const finalWidth = parseInt(previewWindow.style.width);
            const finalHeight = parseInt(previewWindow.style.height);

            // 延迟保存大小到记忆，避免频繁存储操作
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            saveTimeout = setTimeout(() => {
                this.saveWindowSize(finalWidth, finalHeight);
                saveTimeout = null;
            }, LinkWindowConstants.SAVE_DELAY);

            LinkWindowLogger.success(`窗口大小调整完成: ${previewWindow.id}`, `${finalWidth}x${finalHeight}`);

            cleanupResizeState();
            e.preventDefault();
        };

        resizeHandle.addEventListener('mousedown', onMouseDown, { passive: false });

        // 返回清理函数
        return () => {
            resizeHandle.removeEventListener('mousedown', onMouseDown);
            cleanupResizeState();
        };
    }

    closePreview(windowId) {
        const previewWindow = this.previewWindows.get(windowId);
        if (previewWindow) {
            // 清理事件监听器
            if (previewWindow._eventCleanup) {
                previewWindow._eventCleanup();
            }

            // 清理z-index记录
            this.zIndexManager.removeWindow(windowId);

            LinkWindowUtils.safeRemoveElement(previewWindow);
            this.previewWindows.delete(windowId);
            console.log(`🗑️ 预览窗口已关闭: ${windowId}`);
        }
    }

    // 🔧 优化：移除冗余的内联样式，CSS文件已通过manifest.json自动注入
    // 保留此方法以备将来需要动态样式时使用
    loadStyles() {
        // CSS样式已通过manifest.json自动注入，无需重复加载
        // 如果将来需要动态样式，可以在这里添加
    }

    // 🔧 优化：设置URL展示框的交互逻辑
    setupUrlBarInteraction(urlBar) {
        // 统一的全选处理函数
        const handleSelectAll = (e) => {
            e.stopPropagation();
            this.selectAllUrlText(urlBar);
        };

        // 绑定事件（click和dblclick都执行相同操作，只需要click）
        urlBar.addEventListener('click', handleSelectAll);
        urlBar.addEventListener('focus', () => this.selectAllUrlText(urlBar));

        // 键盘快捷键支持
        urlBar.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectAllUrlText(urlBar);
            }
        });

        // 阻止拖拽事件冒泡
        urlBar.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // 🔧 优化：选择URL展示框中的所有文字
    selectAllUrlText(urlBar) {
        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(urlBar);
            selection.removeAllRanges();
            selection.addRange(range);
        } catch (error) {
            // 备用方案
            urlBar.focus();
        }
    }

    // 🔧 优化：简化快捷键更新处理逻辑
    async handleShortcutUpdate(newSettings) {
        try {
            const trigger = newSettings?.linkPreview?.trigger;
            if (!trigger) return;

            // 保存旧设置用于比较
            const oldCustomKey = this.customKey;
            const oldTriggerMethod = this.triggerMethod;

            // 批量更新设置
            const updates = {};
            if (trigger.customKey !== undefined) {
                updates.customKey = trigger.customKey;
            }
            if (trigger.method !== undefined) {
                updates.triggerMethod = trigger.method;
            }
            if (trigger.delay !== undefined) {
                updates.triggerDelay = trigger.delay;
            }

            // 应用更新
            Object.assign(this, updates);

            // 检查是否需要重新绑定事件
            const needsRebind = (oldCustomKey !== this.customKey) || (oldTriggerMethod !== this.triggerMethod);

            if (needsRebind) {
                this.removeEventListeners();
                this.bindEvents();
                this.updateIframeConfigs();
            }

        } catch (error) {
            console.error('快捷键更新失败:', error);
        }
    }
}

// 初始化（优化：简化重复初始化保护逻辑）
function init() {
    // 防止重复初始化
    if (window.momentLinkWindowInitialized) {
        console.log('ℹ️ Moment-LinkWindow 已初始化，跳过');
        return;
    }

    try {
        // 标记已初始化
        window.momentLinkWindowInitialized = true;

        // 初始化管理器
        window.linkWindowTextDragManager = new LinkWindowTextDragManager();
        window.linkWindowPreviewManager = new LinkWindowPreviewManager();

        LinkWindowLogger.success('Moment-LinkWindow 内容脚本已初始化');
    } catch (error) {
        console.error('❌ Moment-LinkWindow 初始化失败:', error);
        // 重置标记以允许重试
        window.momentLinkWindowInitialized = false;
        throw error; // 重新抛出错误以便调试
    }
}

// 启动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}