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

        // 标签页数据
        this.availableTabs = [];
        this.availableTabGroups = [];

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
     * 移除窗口元素（不刷新整个画布）
     */
    removeWindowElement(id) {
        try {
            // 从DOM中移除窗口元素
            const windowElement = document.querySelector(`[data-window-id="${id}"]`);
            if (windowElement) {
                // 如果是真实窗口，先关闭Chrome窗口
                const chromeWindowId = windowElement.dataset.chromeWindowId;
                if (chromeWindowId && typeof chrome !== 'undefined' && chrome.windows) {
                    chrome.windows.remove(parseInt(chromeWindowId)).catch(error => {
                        console.log('⚠️ 关闭Chrome窗口失败:', error.message);
                    });
                }

                windowElement.remove();
                WindowManager.log(`窗口元素已移除: ${id}`);
            }

            // 从数据中删除窗口
            this.deleteWindow(id);

            // 保存配置
            this.saveConfig();

            // 显示状态消息
            this.showStatusMessage(`已删除窗口: ${id}`, 'success');

        } catch (error) {
            console.error('❌ 删除窗口失败:', error);
            this.showStatusMessage('删除窗口失败: ' + error.message, 'error');
        }
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
            const dragDataText = event.dataTransfer.getData('text/plain');

            // 检查是否有拖拽数据
            if (!dragDataText || dragDataText.trim() === '') {
                console.warn('⚠️ 没有拖拽数据');
                return;
            }

            const dragData = JSON.parse(dragDataText);
            const rect = document.getElementById('canvasContainer').getBoundingClientRect();

            // 计算拖拽位置对应的网格坐标
            const pixelX = event.clientX - rect.left;
            const pixelY = event.clientY - rect.top;
            const gridPos = this.pixelToGrid(pixelX, pixelY);

            console.log('🎯 拖拽数据:', dragData, '位置:', gridPos);

            if (dragData.type === 'tab') {
                this.createWindowFromTab(dragData.tab, gridPos.x, gridPos.y);
            } else if (dragData.type === 'tabGroup') {
                this.createWindowFromTabGroup(dragData.tabs, gridPos.x, gridPos.y);
            } else {
                console.warn('⚠️ 未知的拖拽类型:', dragData.type);
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
        // 单个标签页固定使用2×4尺寸
        const window = this.createWindow(x, y, 2, 4, [tab]);
        this.renderWindow(window);
        this.saveConfig();

        WindowManager.log(`从标签页创建窗口: ${tab.title}`);
        this.showStatusMessage(`已创建窗口: ${tab.title}`, 'success');
    }

    /**
     * 从标签页分组创建多个独立窗口
     */
    createWindowFromTabGroup(tabs, startX, startY) {
        // 限制最多6个标签页
        const limitedTabs = tabs.slice(0, 6);
        const tabCount = limitedTabs.length;

        // 根据标签页数量确定窗口尺寸
        const windowSize = this.calculateSingleWindowSize(tabCount);

        // 计算布局配置
        const layoutConfig = this.calculateGroupLayout(tabCount, startX, startY, windowSize);

        const createdWindows = [];

        // 为每个标签页创建独立窗口
        limitedTabs.forEach((tab, index) => {
            const position = layoutConfig.positions[index];
            const window = this.createWindow(
                position.x,
                position.y,
                windowSize.width,
                windowSize.height,
                [tab] // 每个窗口只包含一个标签页
            );
            this.renderWindow(window);
            createdWindows.push(window);
        });

        this.saveConfig();

        WindowManager.log(`从分组创建${createdWindows.length}个独立窗口`);
        this.showStatusMessage(`已创建${createdWindows.length}个窗口`, 'success');

        return createdWindows;
    }

    /**
     * 计算单个窗口尺寸（用于分组中的每个标签页）
     */
    calculateSingleWindowSize(totalTabsInGroup) {
        if (totalTabsInGroup <= 3) {
            return { width: 2, height: 4 }; // 2列×4行，8个单元格，1/3页面
        } else {
            return { width: 2, height: 2 }; // 2列×2行，4个单元格，1/6页面
        }
    }



    /**
     * 计算分组布局（为多个窗口计算位置）
     */
    calculateGroupLayout(tabCount, startX, startY, windowSize) {
        const positions = [];
        const { width: windowWidth, height: windowHeight } = windowSize;

        if (tabCount <= 3) {
            // ≤3个标签页：每个窗口2×4，水平排列
            for (let i = 0; i < tabCount; i++) {
                const x = startX + (i * windowWidth);
                // 确保不超出画布边界
                const finalX = Math.min(x, this.canvasConfig.gridCols - windowWidth);
                const finalY = Math.min(startY, this.canvasConfig.gridRows - windowHeight);

                positions.push({ x: finalX, y: finalY });
            }
        } else {
            // 4-6个标签页：每个窗口2×2，网格排列
            const cols = 3; // 每行最多3个窗口
            for (let i = 0; i < tabCount; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;

                const x = startX + (col * windowWidth);
                const y = startY + (row * windowHeight);

                // 确保不超出画布边界
                const finalX = Math.min(x, this.canvasConfig.gridCols - windowWidth);
                const finalY = Math.min(y, this.canvasConfig.gridRows - windowHeight);

                positions.push({ x: finalX, y: finalY });
            }
        }

        return { positions };
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
        windowElement.className = 'window-item window';
        windowElement.id = window.id;
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
            this.removeWindowElement(window.id);
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
        } else if (window.tabs.length === 1) {
            // 单个标签页：显示iframe
            this.createIframeContent(content, window.tabs[0]);
        } else {
            // 多个标签页：显示标签页切换界面
            this.createTabsContent(content, window.tabs);
        }

        // 添加调整手柄
        const resizeHandles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
        resizeHandles.forEach(direction => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${direction}`;
            windowElement.appendChild(handle);
        });

        // 窗口点击事件（用于调试）
        windowElement.addEventListener('click', () => {
            WindowManager.log(`窗口被点击: ${window.id}`);
        });

        windowElement.appendChild(header);
        windowElement.appendChild(content);

        return windowElement;
    }

    /**
     * 创建iframe内容（单个标签页）
     */
    createIframeContent(content, tab) {
        try {
            // 显示加载状态
            content.innerHTML = `
                <div class="window-loading">
                    <div class="loading-spinner"></div>
                    <p>加载中...</p>
                </div>
            `;

            // 创建iframe
            const iframe = document.createElement('iframe');
            iframe.className = 'window-iframe';
            iframe.src = tab.url;
            // 🎯 增强sandbox权限，支持更多功能
            iframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation';

            // 设置加载超时
            const timeout = setTimeout(() => {
                console.warn(`⏰ iframe 加载超时: ${tab.url}`);
                // 不移除iframe，让它继续尝试加载
            }, 10000);

            // 监听iframe加载事件
            iframe.onload = () => {
                clearTimeout(timeout);
                console.log(`📄 iframe 加载完成: ${tab.url}`);

                // 🎯 注入扩展功能脚本（增强iframe功能）
                this.injectIframeExtensionScript(iframe);

                // 🎯 防止iframe导航事件影响父页面
                this.preventIframeNavigationEvents(iframe);
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
        }
    }

    /**
     * 创建标签页切换内容（多个标签页）
     */
    createTabsContent(content, tabs) {
        // 创建标签页切换界面
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'window-tabs-container';

        // 标签页头部
        const tabsHeader = document.createElement('div');
        tabsHeader.className = 'window-tabs-header';

        tabs.slice(0, 6).forEach((tab, index) => {
            const tabButton = document.createElement('button');
            tabButton.className = `window-tab-button ${index === 0 ? 'active' : ''}`;
            tabButton.dataset.tabIndex = index;
            tabButton.innerHTML = `
                <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%23999" d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"/></svg>'}"
                     alt="" class="tab-favicon">
                <span class="tab-title">${tab.title}</span>
            `;

            // 标签页切换事件
            tabButton.addEventListener('click', () => {
                this.switchWindowTab(content, tabs, index);
            });

            tabsHeader.appendChild(tabButton);
        });

        if (tabs.length > 6) {
            const moreButton = document.createElement('div');
            moreButton.className = 'window-tab-more';
            moreButton.textContent = `+${tabs.length - 6} 更多`;
            tabsHeader.appendChild(moreButton);
        }

        // 标签页内容区域
        const tabsContent = document.createElement('div');
        tabsContent.className = 'window-tabs-content';

        tabsContainer.appendChild(tabsHeader);
        tabsContainer.appendChild(tabsContent);
        content.appendChild(tabsContainer);

        // 默认显示第一个标签页
        this.switchWindowTab(content, tabs, 0);
    }

    /**
     * 切换窗口内的标签页
     */
    switchWindowTab(content, tabs, tabIndex) {
        const tab = tabs[tabIndex];
        if (!tab) return;

        // 更新标签页按钮状态
        content.querySelectorAll('.window-tab-button').forEach((btn, index) => {
            btn.classList.toggle('active', index === tabIndex);
        });

        // 更新内容区域
        const tabsContent = content.querySelector('.window-tabs-content');
        if (tabsContent) {
            this.createIframeContent(tabsContent, tab);
        }
    }

    /**
     * 注入iframe扩展功能脚本（增强iframe功能）
     */
    injectIframeExtensionScript(iframe) {
        try {
            // 检查是否在扩展环境中
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.log('⚠️ 非扩展环境，跳过脚本注入');
                return;
            }

            // 获取iframe的URL
            const iframeUrl = iframe.src;
            if (!iframeUrl) {
                console.log('⚠️ iframe没有src属性，无法注入脚本');
                return;
            }

            console.log('🔧 开始注入iframe扩展脚本:', iframeUrl);

            // 向background script发送消息，请求注入脚本
            chrome.runtime.sendMessage({
                type: 'injectIframeScript',
                data: {
                    url: iframeUrl,
                    parentWindowId: `window-manager-${Date.now()}`,
                    triggerConfig: {
                        method: 'alt+click',
                        key: 'altKey',
                        checkExpression: 'e.altKey'
                    },
                    delay: 300
                }
            }, (response) => {
                if (response && response.success) {
                    console.log('✅ iframe扩展脚本注入成功');
                    // 添加增强功能指示器
                    this.markIframeAsEnhanced(iframe);
                } else {
                    console.log('⚠️ iframe扩展脚本注入失败:', response?.error || 'Unknown error');
                }
            });

        } catch (error) {
            console.log('⚠️ 注入iframe扩展脚本失败:', error.message);
        }
    }

    /**
     * 防止iframe导航事件影响父页面
     */
    preventIframeNavigationEvents(iframe) {
        try {
            // 监听iframe内的导航事件，防止影响父页面
            iframe.addEventListener('load', (e) => {
                e.stopPropagation();
            }, true);

            // 防止iframe内的表单提交影响父页面
            iframe.addEventListener('submit', (e) => {
                e.stopPropagation();
            }, true);

            // 防止iframe内的点击事件冒泡
            iframe.addEventListener('click', (e) => {
                e.stopPropagation();
            }, true);

            console.log('✅ iframe事件隔离已设置');

        } catch (error) {
            console.log('⚠️ 设置iframe事件隔离失败:', error.message);
        }
    }

    /**
     * 标记iframe为功能增强状态
     */
    markIframeAsEnhanced(iframe) {
        try {
            const windowContent = iframe.closest('.window-content');
            if (windowContent) {
                windowContent.classList.add('iframe-enhanced');
                console.log('✅ iframe已标记为功能增强状态');
            }
        } catch (error) {
            console.log('⚠️ 标记iframe增强状态失败:', error.message);
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
     * 清空所有窗口
     */
    clearAllWindows() {
        if (confirm('确定要清空所有窗口吗？')) {
            this.windows = [];
            this.selectedWindow = null;
            this.renderCanvas();
            this.saveConfig();

            console.log('🗑️ 已清空所有窗口');
            this.showStatusMessage('所有窗口已清空', 'success');
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

            // 保存标签页数据供拖拽使用
            this.availableTabs = tabs;
            this.availableTabGroups = tabGroups;

            // 渲染标签页列表
            this.renderTabsList(tabs, tabGroups);

            console.log(`📋 已加载 ${tabs.length} 个标签页`);
        } catch (error) {
            console.error('❌ 加载标签页失败:', error);
            tabsList.innerHTML = '<div class="empty-message">加载失败</div>';
            this.showStatusMessage('加载标签页失败', 'error');
            // 确保数据结构存在
            this.availableTabs = [];
            this.availableTabGroups = [];
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
        html += `<div class="tab-group-header draggable" data-group-id="${group.id}" draggable="true">`;
        html += `<div class="tab-group-color" style="background-color: ${groupColor};"></div>`;
        html += `<span>${group.title || '未命名分组'} (${tabs.length})</span>`;
        html += '<div class="drag-hint">拖拽分组到画布</div>';
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
                <img class="tab-favicon" src="${favicon}" alt="">
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
            // 处理图片加载错误
            const favicon = item.querySelector('.tab-favicon');
            if (favicon) {
                favicon.addEventListener('error', () => {
                    favicon.style.display = 'none';
                });
            }

            item.addEventListener('click', () => {
                const tabId = parseInt(item.dataset.tabId);
                this.selectTab(tabId, item);
            });

            // 双击功能已移除（画布模式不支持）

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
        document.querySelectorAll('.tab-group-header[data-group-id]').forEach(header => {
            header.addEventListener('dragstart', (e) => {
                const groupId = parseInt(header.dataset.groupId);
                const tabs = this.availableTabs.filter(tab => tab.groupId === groupId);
                const group = this.availableTabGroups.find(g => g.id === groupId);

                if (tabs.length > 0 && group) {
                    const dragData = {
                        type: 'tabGroup',
                        group: group,
                        tabs: tabs
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                    header.classList.add('dragging');
                }
            });

            header.addEventListener('dragend', (e) => {
                header.classList.remove('dragging');
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
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(e) {
        // F5: 刷新标签页列表
        if (e.key === 'F5') {
            e.preventDefault();
            this.loadAvailableTabs();
            return;
        }

        // Escape: 取消选择
        if (e.key === 'Escape') {
            e.preventDefault();
            this.clearSelection();
            return;
        }
    }

    /**
     * 清除所有选择
     */
    clearSelection() {
        // 清除标签页选择
        document.querySelectorAll('.tab-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedTab = null;

        console.log('🔄 已清除所有选择');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    const windowManager = new WindowManager();
    await windowManager.init();
    
    // 将实例挂载到全局，方便调试
    window.windowManager = windowManager;
});
