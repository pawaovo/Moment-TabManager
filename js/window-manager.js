/**
 * 窗口管理器核心类
 * 实现多窗口网页内容展示和管理功能
 */

class WindowManager {
    // 日志管理器
    static log(message, type = 'info') {
        const prefix = {
            info: '🪟',
            success: '✅',
            error: '❌',
            warn: '⚠️',
            debug: '🔧'
        }[type] || '📝';

        console.log(`${prefix} WindowManager: ${message}`);
    }
    constructor() {
        // 画布配置
        this.canvasConfig = {
            gridCols: 6,            // 网格列数
            gridRows: 4,            // 网格行数
            cellWidth: 0,           // 单元格宽度 (运行时计算)
            cellHeight: 0           // 单元格高度 (运行时计算)
        };

        // 窗口数组：存储所有窗口信息
        this.windows = [];

        // 当前选中的标签页
        this.selectedTab = null;

        // 当前选中的窗口
        this.selectedWindow = null;

        // 窗口ID计数器
        this.windowIdCounter = 1;

        // 存储键名
        this.STORAGE_KEY = 'window-manager-canvas-config';

        WindowManager.log('初始化画布模式');
    }

    /**
     * 初始化窗口管理器
     */
    async init() {
        try {
            WindowManager.log('开始初始化', 'info');

            // 初始化UI组件
            this.initializeSelectOptions();

            // 加载配置
            await this.loadConfig();

            // 绑定事件
            this.bindEvents();

            // 更新UI
            this.updateUI();

            // 加载标签页列表
            await this.loadAvailableTabs();

            WindowManager.log('初始化完成', 'success');
        } catch (error) {
            console.error('❌ 窗口管理器初始化失败:', error);
            this.showStatusMessage('初始化失败: ' + error.message, 'error');
        }
    }

    /**
     * 创建新窗口
     */
    createWindow(x, y, width, height, tabs = []) {
        const window = {
            id: `window-${this.windowIdCounter++}`,
            x: Math.max(0, Math.min(x, this.canvasConfig.gridCols - width)),
            y: Math.max(0, Math.min(y, this.canvasConfig.gridRows - height)),
            width: Math.max(1, Math.min(width, this.canvasConfig.gridCols)),
            height: Math.max(1, Math.min(height, this.canvasConfig.gridRows)),
            tabs: [...tabs],
            created: Date.now()
        };

        // 检查位置是否可用
        if (!this.isPositionAvailable(window.x, window.y, window.width, window.height)) {
            // 寻找最近的可用位置
            const newPosition = this.findNearestValidPosition(window.x, window.y, window.width, window.height);
            if (newPosition) {
                window.x = newPosition.x;
                window.y = newPosition.y;
            } else {
                throw new Error('画布空间不足，无法创建窗口');
            }
        }

        this.windows.push(window);
        WindowManager.log(`创建窗口: ${window.id} at (${window.x},${window.y}) size ${window.width}×${window.height}`);
        return window;
    }

    /**
     * 更新窗口属性
     */
    updateWindow(id, properties) {
        const window = this.windows.find(w => w.id === id);
        if (!window) {
            throw new Error(`窗口 ${id} 不存在`);
        }

        const oldWindow = { ...window };
        Object.assign(window, properties);

        // 验证新位置和尺寸
        if (properties.x !== undefined || properties.y !== undefined ||
            properties.width !== undefined || properties.height !== undefined) {

            // 临时移除当前窗口进行碰撞检测
            const index = this.windows.indexOf(window);
            this.windows.splice(index, 1);

            if (!this.isPositionAvailable(window.x, window.y, window.width, window.height)) {
                // 恢复原始状态
                Object.assign(window, oldWindow);
                this.windows.splice(index, 0, window);
                throw new Error('目标位置不可用');
            }

            // 重新添加窗口
            this.windows.splice(index, 0, window);
        }

        WindowManager.log(`更新窗口: ${window.id}`);
        return window;
    }

    /**
     * 删除窗口
     */
    deleteWindow(id) {
        const index = this.windows.findIndex(w => w.id === id);
        if (index === -1) {
            throw new Error(`窗口 ${id} 不存在`);
        }

        const window = this.windows.splice(index, 1)[0];
        WindowManager.log(`删除窗口: ${window.id}`);
        return window;
    }

    /**
     * 查找指定位置的窗口
     */
    findWindowAt(x, y) {
        return this.windows.find(window =>
            x >= window.x && x < window.x + window.width &&
            y >= window.y && y < window.y + window.height
        );
    }

    /**
     * 检查位置是否可用
     */
    isPositionAvailable(x, y, width, height) {
        // 检查边界
        if (x < 0 || y < 0 || x + width > this.canvasConfig.gridCols || y + height > this.canvasConfig.gridRows) {
            return false;
        }

        // 检查与现有窗口的重叠
        for (const window of this.windows) {
            if (this.checkWindowCollision(
                { x, y, width, height },
                window
            )) {
                return false;
            }
        }

        return true;
    }

    /**
     * 检查两个窗口是否重叠
     */
    checkWindowCollision(window1, window2) {
        return !(
            window1.x + window1.width <= window2.x ||
            window2.x + window2.width <= window1.x ||
            window1.y + window1.height <= window2.y ||
            window2.y + window2.height <= window1.y
        );
    }

    /**
     * 寻找最近的可用位置
     */
    findNearestValidPosition(targetX, targetY, width, height) {
        const maxDistance = this.canvasConfig.gridCols + this.canvasConfig.gridRows;

        for (let distance = 0; distance <= maxDistance; distance++) {
            // 搜索以目标位置为中心的正方形区域
            for (let dx = -distance; dx <= distance; dx++) {
                for (let dy = -distance; dy <= distance; dy++) {
                    // 只检查边界上的点
                    if (Math.abs(dx) !== distance && Math.abs(dy) !== distance) continue;

                    const x = targetX + dx;
                    const y = targetY + dy;

                    if (this.isPositionAvailable(x, y, width, height)) {
                        return { x, y };
                    }
                }
            }
        }

        return null;
    }

    /**
     * 初始化选择器选项
     */
    initializeSelectOptions() {
        // 为第三行和第四行选择器动态生成选项
        const selectors = ['thirdRowCount', 'fourthRowCount'];

        selectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select) {
                // 清空现有选项
                select.innerHTML = '';

                // 添加1-6个窗口的选项
                for (let i = 1; i <= 6; i++) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = `${i}个窗口`;
                    if (i === 1) option.selected = true; // 默认选择1个窗口
                    select.appendChild(option);
                }
            }
        });
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 侧边栏控制事件
        this.bindSidebarEvents();

        // 画布相关事件
        this.setupCanvas();

        // 刷新标签页列表
        document.getElementById('refreshTabsBtn')?.addEventListener('click', () => {
            this.loadAvailableTabs();
        });

        // 清空所有窗口
        document.getElementById('clearAllBtn')?.addEventListener('click', () => {
            this.clearAllWindows();
        });

        // 添加到窗口
        document.getElementById('addToWindowBtn')?.addEventListener('click', () => {
            this.addTabToWindow();
        });

        // 清空窗口
        document.getElementById('clearWindowBtn')?.addEventListener('click', () => {
            this.clearSelectedWindow();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        console.log('🔗 事件监听器已绑定');
    }

    /**
     * 加载配置
     */
    async loadConfig() {
        try {
            const result = await StorageUtils.loadSettings(this.STORAGE_KEY);
            if (result) {
                // 检查是否是旧版本配置
                if (result.rows !== undefined) {
                    // 迁移旧配置到新结构
                    this.windows = this.migrateOldConfig(result);
                    console.log('📋 已迁移旧配置到画布模式');
                } else if (result.windows) {
                    // 加载新配置
                    this.windows = result.windows || [];
                    this.canvasConfig = { ...this.canvasConfig, ...result.canvasConfig };
                    console.log('📋 画布配置已加载:', { windows: this.windows.length, canvasConfig: this.canvasConfig });
                }

                // 保存迁移后的配置
                await this.saveConfig();
            }
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
        }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
        try {
            const config = {
                windows: this.windows,
                canvasConfig: this.canvasConfig,
                version: '2.0'
            };
            await StorageUtils.saveSettings(config, this.STORAGE_KEY);
            console.log('💾 画布配置已保存:', config);
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            throw error;
        }
    }

    /**
     * 迁移旧配置到新结构
     */
    migrateOldConfig(oldConfig) {
        const windows = [];
        let windowIndex = 0;
        let currentY = 0;

        // 根据旧配置创建窗口
        const rowCounts = [oldConfig.firstRowCount || 2];
        if (oldConfig.rows >= 2) rowCounts.push(oldConfig.secondRowCount || 1);
        if (oldConfig.rows >= 3) rowCounts.push(oldConfig.thirdRowCount || 1);
        if (oldConfig.rows >= 4) rowCounts.push(oldConfig.fourthRowCount || 1);

        for (let row = 0; row < (oldConfig.rows || 1); row++) {
            const windowsInRow = rowCounts[row] || 1;
            const windowWidth = Math.floor(this.canvasConfig.gridCols / windowsInRow);
            const windowHeight = Math.floor(this.canvasConfig.gridRows / (oldConfig.rows || 1));

            for (let col = 0; col < windowsInRow; col++) {
                windows.push({
                    id: `migrated-window-${windowIndex++}`,
                    x: col * windowWidth,
                    y: currentY,
                    width: windowWidth,
                    height: windowHeight,
                    tabs: [],
                    created: Date.now(),
                    migrated: true
                });
            }

            currentY += windowHeight;
        }

        WindowManager.log(`迁移完成: 创建了 ${windows.length} 个窗口`);
        return windows;
    }

    /**
     * 绑定侧边栏事件
     */
    bindSidebarEvents() {
        const trigger = document.getElementById('sidebarTrigger');
        const panel = document.getElementById('controlPanel');

        if (!trigger || !panel) return;

        // 鼠标进入触发区域时展开侧边栏
        trigger.addEventListener('mouseenter', () => {
            panel.classList.add('expanded');
        });

        // 鼠标离开侧边栏时收起
        panel.addEventListener('mouseleave', () => {
            panel.classList.remove('expanded');
        });

        // 鼠标进入侧边栏时保持展开
        panel.addEventListener('mouseenter', () => {
            panel.classList.add('expanded');
        });
    }

    /**
     * 更新布局配置
     */
    async updateLayoutConfig(key, value) {
        try {
            this.config[key] = value;
            await this.saveConfig();
            this.updateRowControls();
            console.log(`🔧 布局配置已更新: ${key} = ${value}`);
        } catch (error) {
            console.error('❌ 更新布局配置失败:', error);
            this.showStatusMessage('更新配置失败', 'error');
        }
    }

    /**
     * 设置画布
     */
    setupCanvas() {
        this.initializeCanvasDimensions();
        this.setupDropZone();
        this.renderCanvas();

        // 监听窗口大小变化
        window.addEventListener('resize', () => {
            this.initializeCanvasDimensions();
        });

        WindowManager.log('画布初始化完成');
    }

    /**
     * 初始化画布尺寸
     */
    initializeCanvasDimensions() {
        const canvasContainer = document.getElementById('canvasContainer');
        if (!canvasContainer) return;

        const rect = canvasContainer.getBoundingClientRect();
        this.canvasConfig.cellWidth = rect.width / this.canvasConfig.gridCols;
        this.canvasConfig.cellHeight = rect.height / this.canvasConfig.gridRows;

        WindowManager.log(`画布尺寸: ${rect.width}×${rect.height}, 单元格: ${this.canvasConfig.cellWidth}×${this.canvasConfig.cellHeight}`);
    }

    /**
     * 设置拖拽放置区域
     */
    setupDropZone() {
        const canvasContainer = document.getElementById('canvasContainer');
        if (!canvasContainer) return;

        // 设置拖拽放置事件
        canvasContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.showGridOverlay();
        });

        canvasContainer.addEventListener('dragleave', (e) => {
            // 只有当离开整个容器时才隐藏网格
            if (!canvasContainer.contains(e.relatedTarget)) {
                this.hideGridOverlay();
            }
        });

        canvasContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.hideGridOverlay();
            this.handleCanvasDrop(e);
        });
    }

    /**
     * 更新UI
     */
    updateUI() {
        this.renderCanvas();
    }

    /**
     * 处理画布拖拽放置
     */
    handleCanvasDrop(event) {
        try {
            const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
            const rect = document.getElementById('canvasContainer').getBoundingClientRect();

            // 计算拖拽位置对应的网格坐标
            const pixelX = event.clientX - rect.left;
            const pixelY = event.clientY - rect.top;
            const gridPos = this.pixelToGrid(pixelX, pixelY);

            if (dragData.type === 'tab') {
                this.createWindowFromTab(dragData.tab, gridPos.x, gridPos.y);
            } else if (dragData.type === 'tabGroup') {
                this.createWindowFromTabGroup(dragData.tabs, gridPos.x, gridPos.y);
            }

        } catch (error) {
            console.error('❌ 处理拖拽放置失败:', error);
            this.showStatusMessage('创建窗口失败: ' + error.message, 'error');
        }
    }

    /**
     * 像素坐标转网格坐标
     */
    pixelToGrid(pixelX, pixelY) {
        return {
            x: Math.floor(pixelX / this.canvasConfig.cellWidth),
            y: Math.floor(pixelY / this.canvasConfig.cellHeight)
        };
    }

    /**
     * 网格坐标转像素坐标
     */
    gridToPixel(gridX, gridY) {
        return {
            x: gridX * this.canvasConfig.cellWidth,
            y: gridY * this.canvasConfig.cellHeight
        };
    }

    /**
     * 显示网格辅助
     */
    showGridOverlay() {
        const gridOverlay = document.getElementById('gridOverlay');
        if (gridOverlay) {
            gridOverlay.classList.add('visible');
        }
    }

    /**
     * 隐藏网格辅助
     */
    hideGridOverlay() {
        const gridOverlay = document.getElementById('gridOverlay');
        if (gridOverlay) {
            gridOverlay.classList.remove('visible');
        }
    }

    /**
     * 从单个标签页创建窗口
     */
    createWindowFromTab(tab, x, y) {
        const windowSize = this.calculateWindowSize([tab]);
        const window = this.createWindow(x, y, windowSize.width, windowSize.height, [tab]);
        this.renderWindow(window);
        this.saveConfig();

        WindowManager.log(`从标签页创建窗口: ${tab.title}`);
        this.showStatusMessage(`已创建窗口: ${tab.title}`, 'success');
    }

    /**
     * 从标签页分组创建窗口
     */
    createWindowFromTabGroup(tabs, x, y) {
        const windowSize = this.calculateWindowSize(tabs);
        const window = this.createWindow(x, y, windowSize.width, windowSize.height, tabs);
        this.renderWindow(window);
        this.saveConfig();

        WindowManager.log(`从分组创建窗口: ${tabs.length}个标签页`);
        this.showStatusMessage(`已创建窗口: ${tabs.length}个标签页`, 'success');
    }

    /**
     * 计算窗口尺寸
     */
    calculateWindowSize(tabs) {
        const tabCount = tabs.length;

        if (tabCount === 1) {
            return { width: 2, height: 2 }; // 2×2单元格
        } else if (tabCount <= 3) {
            return { width: 2, height: 2 }; // 2×2单元格
        } else if (tabCount <= 6) {
            return { width: 3, height: 2 }; // 3×2单元格
        } else {
            return { width: 3, height: 3 }; // 3×3单元格
        }
    }

    /**
     * 渲染画布
     */
    renderCanvas() {
        const windowsLayer = document.getElementById('windowsLayer');
        const emptyState = document.getElementById('emptyState');

        if (!windowsLayer || !emptyState) return;

        // 清空现有窗口
        windowsLayer.innerHTML = '';

        if (this.windows.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';

            // 渲染所有窗口
            this.windows.forEach(window => {
                this.renderWindow(window);
            });
        }
    }

    /**
     * 显示状态消息
     */
    showStatusMessage(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-message ${type}`;
            statusEl.classList.remove('hidden');
            
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 3000);
        }
        
        console.log(`📢 状态消息 [${type}]: ${message}`);
    }

    /**
     * 渲染单个窗口
     */
    renderWindow(window) {
        const windowsLayer = document.getElementById('windowsLayer');
        if (!windowsLayer) return;

        const windowElement = this.createWindowElement(window);
        windowsLayer.appendChild(windowElement);

        // 设置窗口位置和尺寸
        this.positionWindow(windowElement, window);

        // 设置拖拽和调整功能
        this.setupWindowInteraction(windowElement, window);
    }

    /**
     * 设置窗口位置
     */
    positionWindow(element, window) {
        const pixel = this.gridToPixel(window.x, window.y);
        const width = window.width * this.canvasConfig.cellWidth;
        const height = window.height * this.canvasConfig.cellHeight;

        element.style.left = `${pixel.x}px`;
        element.style.top = `${pixel.y}px`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
    }

    /**
     * 设置窗口交互功能
     */
    setupWindowInteraction(element, window) {
        // 使用interact.js设置拖拽
        interact(element)
            .draggable({
                listeners: {
                    start: (event) => {
                        event.target.classList.add('dragging');
                        this.showGridOverlay();
                    },
                    move: (event) => {
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                        target.style.transform = `translate(${x}px, ${y}px)`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    },
                    end: (event) => {
                        event.target.classList.remove('dragging');
                        this.hideGridOverlay();
                        this.snapWindowToGrid(event.target, window);
                    }
                }
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                listeners: {
                    start: (event) => {
                        this.showGridOverlay();
                    },
                    move: (event) => {
                        const target = event.target;
                        let x = (parseFloat(target.getAttribute('data-x')) || 0);
                        let y = (parseFloat(target.getAttribute('data-y')) || 0);

                        target.style.width = event.rect.width + 'px';
                        target.style.height = event.rect.height + 'px';

                        x += event.deltaRect.left;
                        y += event.deltaRect.top;

                        target.style.transform = `translate(${x}px, ${y}px)`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                    },
                    end: (event) => {
                        this.hideGridOverlay();
                        this.snapWindowToGrid(event.target, window);
                    }
                }
            });
    }

    /**
     * 将窗口吸附到网格
     */
    snapWindowToGrid(element, window) {
        const rect = element.getBoundingClientRect();
        const canvasRect = document.getElementById('canvasContainer').getBoundingClientRect();

        // 计算相对于画布的位置
        const relativeX = rect.left - canvasRect.left;
        const relativeY = rect.top - canvasRect.top;

        // 转换为网格坐标
        const gridPos = this.pixelToGrid(relativeX, relativeY);
        const gridWidth = Math.round(rect.width / this.canvasConfig.cellWidth);
        const gridHeight = Math.round(rect.height / this.canvasConfig.cellHeight);

        // 确保在边界内
        const clampedX = Math.max(0, Math.min(gridPos.x, this.canvasConfig.gridCols - gridWidth));
        const clampedY = Math.max(0, Math.min(gridPos.y, this.canvasConfig.gridRows - gridHeight));
        const clampedWidth = Math.max(1, Math.min(gridWidth, this.canvasConfig.gridCols - clampedX));
        const clampedHeight = Math.max(1, Math.min(gridHeight, this.canvasConfig.gridRows - clampedY));

        // 检查碰撞并找到最近的有效位置
        const validPos = this.findNearestValidPosition(clampedX, clampedY, clampedWidth, clampedHeight, window.id);

        // 更新窗口数据
        this.updateWindow(window.id, {
            x: validPos.x,
            y: validPos.y,
            width: clampedWidth,
            height: clampedHeight
        });

        // 重新定位窗口元素
        this.positionWindow(element, { ...window, x: validPos.x, y: validPos.y, width: clampedWidth, height: clampedHeight });

        // 清除transform
        element.style.transform = '';
        element.removeAttribute('data-x');
        element.removeAttribute('data-y');

        // 保存配置
        this.saveConfig();
    }

    /**
     * 创建窗口元素
     */
    createWindowElement(window) {
        const windowElement = document.createElement('div');
        windowElement.className = 'window-item';
        windowElement.dataset.windowId = window.id;

        // 窗口头部
        const header = document.createElement('div');
        header.className = 'window-header';

        const title = document.createElement('div');
        title.className = 'window-title';
        title.textContent = window.tabs.length > 0 ?
            `${window.tabs[0].title} ${window.tabs.length > 1 ? `(+${window.tabs.length - 1})` : ''}` :
            `窗口 ${window.id}`;

        const controls = document.createElement('div');
        controls.className = 'window-controls';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'window-control-btn close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteWindow(window.id);
            this.renderCanvas();
        });

        controls.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(controls);

        // 窗口内容
        const content = document.createElement('div');
        content.className = 'window-content';

        if (window.tabs.length === 0) {
            // 空状态
            const emptyState = document.createElement('div');
            emptyState.className = 'window-empty';
            emptyState.innerHTML = `
                <div class="window-empty-icon">📄</div>
                <p class="window-empty-text">拖拽标签页到此处</p>
            `;
            content.appendChild(emptyState);
        } else {
            // 显示标签页
            const tabsList = document.createElement('div');
            tabsList.className = 'window-tabs-list';

            window.tabs.slice(0, 6).forEach(tab => { // 最多显示6个标签页
                const tabItem = document.createElement('div');
                tabItem.className = 'window-tab-item';
                tabItem.innerHTML = `
                    <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23999" d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"/></svg>'}"
                         alt="" class="tab-favicon">
                    <span class="tab-title">${tab.title}</span>
                `;
                tabsList.appendChild(tabItem);
            });

            if (window.tabs.length > 6) {
                const moreItem = document.createElement('div');
                moreItem.className = 'window-tab-more';
                moreItem.textContent = `+${window.tabs.length - 6} 更多`;
                tabsList.appendChild(moreItem);
            }

            content.appendChild(tabsList);
        }

        // 添加调整手柄
        const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        resizeHandles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction}`;
            windowElement.appendChild(handle);
        });

        // 窗口点击事件
        windowElement.addEventListener('click', () => this.selectWindow(window.id));

        windowElement.appendChild(header);
        windowElement.appendChild(content);

        return windowElement;
    }

    /**
     * 选择窗口
     */
    selectWindow(index) {
        // 移除之前的选中状态
        document.querySelectorAll('.window-item.active').forEach(item => {
            item.classList.remove('active');
        });

        // 添加新的选中状态
        const window = document.querySelector(`[data-window-index="${index}"]`);
        if (window) {
            window.classList.add('active');
            this.selectedWindow = index;

            // 更新按钮状态
            this.updateButtonStates();

            console.log(`🎯 已选择窗口: ${index}`);
        }
    }

    /**
     * 更新按钮状态
     */
    updateButtonStates() {
        const addBtn = document.getElementById('addToWindowBtn');
        const clearBtn = document.getElementById('clearWindowBtn');

        const hasSelectedTab = this.selectedTab !== null;
        const hasSelectedWindow = this.selectedWindow !== null;

        if (addBtn) {
            addBtn.disabled = !hasSelectedTab || !hasSelectedWindow;
        }

        if (clearBtn) {
            clearBtn.disabled = !hasSelectedWindow || !this.windows.has(this.selectedWindow);
        }
    }

    /**
     * 清空指定窗口
     */
    clearWindow(index) {
        const window = document.querySelector(`[data-window-index="${index}"]`);
        if (!window) return;

        const content = window.querySelector('.window-content');
        if (!content) return;

        // 移除iframe
        const iframe = content.querySelector('.window-iframe');
        if (iframe) {
            iframe.remove();
        }

        // 显示空状态
        content.innerHTML = `
            <div class="window-empty">
                <div class="window-empty-icon">📄</div>
                <p class="window-empty-text">点击右侧标签页添加内容</p>
            </div>
        `;

        // 更新窗口标题
        const title = window.querySelector('.window-title');
        if (title) {
            title.textContent = `窗口 ${index + 1}`;
        }

        // 移除映射关系
        this.windows.delete(index);

        // 更新按钮状态
        this.updateButtonStates();

        console.log(`🗑️ 已清空窗口: ${index}`);
        this.showStatusMessage(`窗口 ${index + 1} 已清空`, 'success');
    }

    /**
     * 清空所有窗口
     */
    clearAllWindows() {
        if (confirm('确定要清空所有窗口吗？')) {
            this.windows = [];
            this.selectedWindow = null;
            this.renderCanvas();
            this.updateButtonStates();
            this.saveConfig();

            console.log('🗑️ 已清空所有窗口');
            this.showStatusMessage('所有窗口已清空', 'success');
        }
    }

    /**
     * 清空选中的窗口
     */
    clearSelectedWindow() {
        if (this.selectedWindow !== null) {
            this.clearWindow(this.selectedWindow);
        }
    }

    /**
     * 加载可用标签页
     */
    async loadAvailableTabs() {
        const tabsList = document.getElementById('tabsList');
        if (!tabsList) return;

        try {
            // 显示加载状态
            tabsList.innerHTML = '<div class="loading-message">加载标签页中...</div>';

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});

            // 获取标签分组
            const tabGroups = await chrome.tabGroups.query({});

            // 渲染标签页列表
            this.renderTabsList(tabs, tabGroups);

            console.log(`📋 已加载 ${tabs.length} 个标签页`);
        } catch (error) {
            console.error('❌ 加载标签页失败:', error);
            tabsList.innerHTML = '<div class="empty-message">加载失败</div>';
            this.showStatusMessage('加载标签页失败', 'error');
        }
    }

    /**
     * 渲染标签页列表
     */
    renderTabsList(tabs, tabGroups) {
        const tabsList = document.getElementById('tabsList');
        if (!tabsList) return;

        if (tabs.length === 0) {
            tabsList.innerHTML = '<div class="empty-message">没有可用的标签页</div>';
            return;
        }

        // 按分组组织标签页
        const groupedTabs = new Map();
        const ungroupedTabs = [];

        tabs.forEach(tab => {
            if (tab.groupId && tab.groupId !== -1) {
                if (!groupedTabs.has(tab.groupId)) {
                    groupedTabs.set(tab.groupId, []);
                }
                groupedTabs.get(tab.groupId).push(tab);
            } else {
                ungroupedTabs.push(tab);
            }
        });

        let html = '';

        // 渲染分组标签页
        tabGroups.forEach(group => {
            const groupTabs = groupedTabs.get(group.id) || [];
            if (groupTabs.length > 0) {
                html += this.renderTabGroup(group, groupTabs);
            }
        });

        // 渲染未分组标签页
        if (ungroupedTabs.length > 0) {
            html += '<div class="tab-group">';
            html += '<div class="tab-group-header">';
            html += '<span>未分组标签页</span>';
            html += '</div>';
            html += '<div class="tab-group-tabs">';
            ungroupedTabs.forEach(tab => {
                html += this.renderTabItem(tab);
            });
            html += '</div>';
            html += '</div>';
        }

        tabsList.innerHTML = html;

        // 绑定标签页点击事件
        this.bindTabEvents();
    }

    /**
     * 渲染标签分组
     */
    renderTabGroup(group, tabs) {
        const groupColor = group.color || 'grey';
        let html = '<div class="tab-group">';
        html += '<div class="tab-group-header">';
        html += `<div class="tab-group-color" style="background-color: ${groupColor};"></div>`;
        html += `<span>${group.title || '未命名分组'} (${tabs.length})</span>`;
        html += '</div>';
        html += '<div class="tab-group-tabs">';
        tabs.forEach(tab => {
            html += this.renderTabItem(tab);
        });
        html += '</div>';
        html += '</div>';
        return html;
    }

    /**
     * 渲染单个标签页
     */
    renderTabItem(tab) {
        const favicon = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
        const title = tab.title || '无标题';
        const url = tab.url || '';
        const domain = this.getDomainFromUrl(url);

        return `
            <div class="tab-item draggable" data-tab-id="${tab.id}" title="${title}" draggable="true">
                <img class="tab-favicon" src="${favicon}" alt="" onerror="this.style.display='none'">
                <div class="tab-info">
                    <div class="tab-title">${title}</div>
                    <div class="tab-url">${domain}</div>
                </div>
            </div>
        `;
    }

    /**
     * 从URL获取域名
     */
    getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    /**
     * 绑定标签页事件
     */
    bindTabEvents() {
        document.querySelectorAll('.tab-item').forEach(item => {
            item.addEventListener('click', () => {
                const tabId = parseInt(item.dataset.tabId);
                this.selectTab(tabId, item);
            });

            // 双击直接添加到空窗口
            item.addEventListener('dblclick', () => {
                const tabId = parseInt(item.dataset.tabId);
                this.autoAddTabToWindow(tabId);
            });

            // 拖拽开始事件
            item.addEventListener('dragstart', (e) => {
                const tabId = parseInt(item.dataset.tabId);
                const tab = this.availableTabs.find(t => t.id === tabId);
                if (tab) {
                    const dragData = {
                        type: 'tab',
                        tab: tab
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                    item.classList.add('dragging');
                }
            });

            // 拖拽结束事件
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });

        // 绑定标签页分组拖拽事件
        document.querySelectorAll('.tab-group').forEach(group => {
            group.addEventListener('dragstart', (e) => {
                const groupId = parseInt(group.dataset.groupId);
                const tabs = this.availableTabs.filter(tab => tab.groupId === groupId);
                if (tabs.length > 0) {
                    const dragData = {
                        type: 'tabGroup',
                        tabs: tabs
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                    group.classList.add('dragging');
                }
            });

            group.addEventListener('dragend', (e) => {
                group.classList.remove('dragging');
            });
        });
    }

    /**
     * 选择标签页
     */
    selectTab(tabId, element) {
        // 移除之前的选中状态
        document.querySelectorAll('.tab-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        // 添加新的选中状态
        element.classList.add('selected');
        this.selectedTab = tabId;

        // 更新按钮状态
        this.updateButtonStates();

        console.log(`🎯 已选择标签页: ${tabId}`);
    }

    /**
     * 添加标签页到窗口
     */
    async addTabToWindow() {
        if (this.selectedTab === null || this.selectedWindow === null) {
            this.showStatusMessage('请先选择标签页和窗口', 'error');
            return;
        }

        try {
            // 获取标签页信息
            const tab = await chrome.tabs.get(this.selectedTab);

            // 加载标签页到窗口
            await this.loadTabInWindow(tab, this.selectedWindow);

            // 保存映射关系
            this.windows.set(this.selectedWindow, this.selectedTab);

            // 更新按钮状态
            this.updateButtonStates();

            console.log(`✅ 标签页 ${this.selectedTab} 已添加到窗口 ${this.selectedWindow}`);
            this.showStatusMessage(`已添加到窗口 ${this.selectedWindow + 1}`, 'success');

        } catch (error) {
            console.error('❌ 添加标签页到窗口失败:', error);
            this.showStatusMessage('添加失败: ' + error.message, 'error');
        }
    }

    /**
     * 在窗口中加载标签页内容
     */
    async loadTabInWindow(tab, windowIndex) {
        const window = document.querySelector(`[data-window-index="${windowIndex}"]`);
        if (!window) {
            throw new Error(`窗口 ${windowIndex} 不存在`);
        }

        const content = window.querySelector('.window-content');
        const title = window.querySelector('.window-title');

        if (!content || !title) {
            throw new Error('窗口结构不完整');
        }

        // 显示加载状态
        content.innerHTML = `
            <div class="window-loading">
                <div class="loading-spinner"></div>
                <p>加载中...</p>
            </div>
        `;

        // 更新窗口标题
        title.textContent = tab.title || '无标题';

        try {
            // 创建iframe
            const iframe = document.createElement('iframe');
            iframe.className = 'window-iframe';
            iframe.src = tab.url;
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox';

            // 设置加载超时
            const timeout = setTimeout(() => {
                console.warn(`⏰ iframe 加载超时: ${tab.url}`);
                // 不移除iframe，让它继续尝试加载
            }, 10000);

            // 监听iframe加载事件（合并重复的onload处理）
            iframe.onload = () => {
                clearTimeout(timeout);
                console.log(`📄 iframe 加载完成: ${tab.url}`);
            };

            iframe.onerror = () => {
                clearTimeout(timeout);
                console.error(`❌ iframe 加载失败: ${tab.url}`);
                this.showIframeError(content, '加载失败');
            };

            // 替换加载状态为iframe
            content.innerHTML = '';
            content.appendChild(iframe);

        } catch (error) {
            console.error('❌ 创建iframe失败:', error);
            this.showIframeError(content, error.message);
            throw error;
        }
    }

    /**
     * 显示iframe错误状态
     */
    showIframeError(content, message) {
        content.innerHTML = `
            <div class="window-error">
                <div class="window-error-icon">⚠️</div>
                <p class="window-error-text">加载失败: ${message}</p>
            </div>
        `;
    }

    /**
     * 查找空窗口
     */
    findEmptyWindow() {
        const totalWindows = this.config.rows === 1
            ? this.config.firstRowCount
            : this.config.firstRowCount + this.config.secondRowCount;

        for (let i = 0; i < totalWindows; i++) {
            if (!this.windows.has(i)) {
                return i;
            }
        }
        return null;
    }

    /**
     * 自动添加标签页到空窗口
     */
    async autoAddTabToWindow(tabId) {
        const emptyWindow = this.findEmptyWindow();
        if (emptyWindow === null) {
            this.showStatusMessage('没有空窗口可用', 'error');
            return false;
        }

        try {
            const tab = await chrome.tabs.get(tabId);
            await this.loadTabInWindow(tab, emptyWindow);
            this.windows.set(emptyWindow, tabId);

            // 选中这个窗口
            this.selectWindow(emptyWindow);

            console.log(`✅ 标签页 ${tabId} 已自动添加到窗口 ${emptyWindow}`);
            this.showStatusMessage(`已添加到窗口 ${emptyWindow + 1}`, 'success');
            return true;

        } catch (error) {
            console.error('❌ 自动添加标签页失败:', error);
            this.showStatusMessage('添加失败: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter: 添加选中标签页到选中窗口
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedTab !== null && this.selectedWindow !== null) {
                this.addTabToWindow();
            }
            return;
        }

        // Delete/Backspace: 清空选中窗口
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedWindow !== null) {
            e.preventDefault();
            this.clearSelectedWindow();
            return;
        }

        // Escape: 取消选择
        if (e.key === 'Escape') {
            e.preventDefault();
            this.clearSelection();
            return;
        }

        // F5: 刷新标签页列表
        if (e.key === 'F5') {
            e.preventDefault();
            this.loadAvailableTabs();
            return;
        }

        // 数字键1-9: 选择窗口
        if (e.key >= '1' && e.key <= '9') {
            const windowIndex = parseInt(e.key) - 1;
            const totalWindows = this.config.rows === 1
                ? this.config.firstRowCount
                : this.config.firstRowCount + this.config.secondRowCount;

            if (windowIndex < totalWindows) {
                e.preventDefault();
                this.selectWindow(windowIndex);
            }
            return;
        }
    }

    /**
     * 清除所有选择
     */
    clearSelection() {
        // 清除窗口选择
        document.querySelectorAll('.window-item.active').forEach(item => {
            item.classList.remove('active');
        });
        this.selectedWindow = null;

        // 清除标签页选择
        document.querySelectorAll('.tab-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedTab = null;

        // 更新按钮状态
        this.updateButtonStates();

        console.log('🔄 已清除所有选择');
    }

    /**
     * 获取窗口统计信息
     */
    getWindowStats() {
        const totalWindows = this.config.rows === 1
            ? this.config.firstRowCount
            : this.config.firstRowCount + this.config.secondRowCount;

        const usedWindows = this.windows.size;
        const emptyWindows = totalWindows - usedWindows;

        return {
            total: totalWindows,
            used: usedWindows,
            empty: emptyWindows
        };
    }

    /**
     * 更新状态信息显示
     */
    updateStatusInfo() {
        const stats = this.getWindowStats();
        const statusText = `窗口: ${stats.used}/${stats.total} 使用中`;

        // 可以在这里更新状态栏显示
        console.log(`📊 ${statusText}`);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    const windowManager = new WindowManager();
    await windowManager.init();
    
    // 将实例挂载到全局，方便调试
    window.windowManager = windowManager;
});
