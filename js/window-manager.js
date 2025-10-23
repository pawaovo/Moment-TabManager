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
        // 配置信息
        this.config = {
            rows: 1,                // 行数：1-4
            firstRowCount: 2,       // 第一行窗口数：1-6
            secondRowCount: 1,      // 第二行窗口数：1-6
            thirdRowCount: 1,       // 第三行窗口数：1-6
            fourthRowCount: 1       // 第四行窗口数：1-6
        };
        
        // 窗口映射：windowIndex -> tabId
        this.windows = new Map();
        
        // 当前选中的标签页
        this.selectedTab = null;
        
        // 当前选中的窗口
        this.selectedWindow = null;
        
        // 存储键名
        this.STORAGE_KEY = 'window-manager-config';
        
        WindowManager.log('初始化');
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
        // 布局配置事件
        document.getElementById('layoutRows')?.addEventListener('change', (e) => {
            this.updateLayoutConfig('rows', parseInt(e.target.value));
        });

        document.getElementById('firstRowCount')?.addEventListener('change', (e) => {
            this.updateLayoutConfig('firstRowCount', parseInt(e.target.value));
        });

        document.getElementById('secondRowCount')?.addEventListener('change', (e) => {
            this.updateLayoutConfig('secondRowCount', parseInt(e.target.value));
        });

        document.getElementById('thirdRowCount')?.addEventListener('change', (e) => {
            this.updateLayoutConfig('thirdRowCount', parseInt(e.target.value));
        });

        document.getElementById('fourthRowCount')?.addEventListener('change', (e) => {
            this.updateLayoutConfig('fourthRowCount', parseInt(e.target.value));
        });

        // 应用布局按钮
        document.getElementById('applyLayoutBtn')?.addEventListener('click', () => {
            this.updateLayout();
        });

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
                this.config = { ...this.config, ...result };
                console.log('📋 配置已加载:', this.config);
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
            await StorageUtils.saveSettings(this.config, this.STORAGE_KEY);
            console.log('💾 配置已保存:', this.config);
        } catch (error) {
            console.error('❌ 保存配置失败:', error);
            throw error;
        }
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
     * 更新行数控制UI
     */
    updateRowControls() {
        const rows = this.config.rows;
        const secondRowContainer = document.getElementById('secondRowContainer');
        const thirdRowContainer = document.getElementById('thirdRowContainer');
        const fourthRowContainer = document.getElementById('fourthRowContainer');

        // 显示/隐藏行数控制
        if (secondRowContainer) {
            secondRowContainer.style.display = rows >= 2 ? 'block' : 'none';
        }
        if (thirdRowContainer) {
            thirdRowContainer.style.display = rows >= 3 ? 'block' : 'none';
        }
        if (fourthRowContainer) {
            fourthRowContainer.style.display = rows >= 4 ? 'block' : 'none';
        }

        // 更新选择器值
        const layoutRows = document.getElementById('layoutRows');
        const firstRowCount = document.getElementById('firstRowCount');
        const secondRowCount = document.getElementById('secondRowCount');
        const thirdRowCount = document.getElementById('thirdRowCount');
        const fourthRowCount = document.getElementById('fourthRowCount');

        if (layoutRows) layoutRows.value = this.config.rows.toString();
        if (firstRowCount) firstRowCount.value = this.config.firstRowCount.toString();
        if (secondRowCount) secondRowCount.value = this.config.secondRowCount.toString();
        if (thirdRowCount) thirdRowCount.value = this.config.thirdRowCount.toString();
        if (fourthRowCount) fourthRowCount.value = this.config.fourthRowCount.toString();
    }

    /**
     * 更新UI
     */
    updateUI() {
        this.updateRowControls();
        this.updateLayout();
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
     * 更新窗口布局
     */
    updateLayout() {
        const container = document.getElementById('windowsContainer');
        if (!container) return;

        // 清空现有内容
        container.innerHTML = '';

        // 计算总窗口数
        let totalWindows = this.config.firstRowCount;
        if (this.config.rows >= 2) totalWindows += this.config.secondRowCount;
        if (this.config.rows >= 3) totalWindows += this.config.thirdRowCount;
        if (this.config.rows >= 4) totalWindows += this.config.fourthRowCount;

        // 创建网格容器
        const grid = document.createElement('div');
        grid.className = 'windows-grid';

        // 设置网格布局
        this.applyGridLayout(grid);

        // 创建窗口并设置网格位置
        let windowIndex = 0;
        const rowCounts = [this.config.firstRowCount];
        if (this.config.rows >= 2) rowCounts.push(this.config.secondRowCount);
        if (this.config.rows >= 3) rowCounts.push(this.config.thirdRowCount);
        if (this.config.rows >= 4) rowCounts.push(this.config.fourthRowCount);

        for (let row = 0; row < this.config.rows; row++) {
            for (let col = 0; col < rowCounts[row]; col++) {
                const window = this.createWindow(windowIndex, row + 1, col + 1);
                grid.appendChild(window);
                windowIndex++;
            }
        }

        container.appendChild(grid);
        console.log(`🔄 布局已更新: ${this.config.rows}行布局, 总窗口数: ${totalWindows}`);
    }

    /**
     * 应用网格布局
     */
    applyGridLayout(grid) {
        const { rows, firstRowCount, secondRowCount, thirdRowCount, fourthRowCount } = this.config;

        // 计算最大列数
        const maxColumns = Math.max(
            firstRowCount,
            rows >= 2 ? secondRowCount : 0,
            rows >= 3 ? thirdRowCount : 0,
            rows >= 4 ? fourthRowCount : 0
        );

        // 设置网格行和列
        grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        grid.style.gridTemplateColumns = `repeat(${maxColumns}, 1fr)`;

        console.log(`🎯 应用网格布局: ${rows}行 × ${maxColumns}列`);
    }



    /**
     * 创建单个窗口
     */
    createWindow(index, gridRow = null, gridColumn = null) {
        const window = document.createElement('div');
        window.className = 'window-item';
        window.dataset.windowIndex = index;

        // 设置网格位置（如果提供）
        if (gridRow !== null && gridColumn !== null) {
            window.style.gridRow = gridRow;
            window.style.gridColumn = gridColumn;
        }

        // 窗口头部
        const header = document.createElement('div');
        header.className = 'window-header';

        const title = document.createElement('div');
        title.className = 'window-title';
        title.textContent = `窗口 ${index + 1}`;

        const controls = document.createElement('div');
        controls.className = 'window-controls';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'window-control-btn close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => this.clearWindow(index));

        controls.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(controls);

        // 窗口内容
        const content = document.createElement('div');
        content.className = 'window-content';

        // 空状态
        const emptyState = document.createElement('div');
        emptyState.className = 'window-empty';
        emptyState.innerHTML = `
            <div class="window-empty-icon">📄</div>
            <p class="window-empty-text">点击右侧标签页添加内容</p>
        `;

        content.appendChild(emptyState);

        // 窗口点击事件
        window.addEventListener('click', () => this.selectWindow(index));

        window.appendChild(header);
        window.appendChild(content);

        return window;
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
            this.windows.clear();
            this.selectedWindow = null;
            this.updateLayout();
            this.updateButtonStates();

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
            <div class="tab-item" data-tab-id="${tab.id}" title="${title}">
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
