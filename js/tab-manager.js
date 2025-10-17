/**
 * 标签管理器核心类
 * 负责所有标签页管理功能的实现
 */
class TabManager {
    constructor() {
        this.settings = {};
        this.isInitialized = false;

        // 🔧 优化：统一的防重复触发机制
        this.actionCooldowns = new Map();
        this.defaultCooldown = 100; // 100ms内不允许重复触发

        this.init();
    }

    async init() {
        try {
            await this.loadSettings();
            this.isInitialized = true;
            console.log('✅ 标签管理器初始化完成');
        } catch (error) {
            console.error('❌ 标签管理器初始化失败:', error);
        }
    }

    // 🔧 优化：统一的设置管理方法
    async loadSettings() {
        try {
            this.settings = await StorageUtils.loadSettings();
            console.log('📋 已加载设置:', this.settings);
        } catch (error) {
            console.warn('⚠️ 加载设置失败，使用默认设置:', error);
            this.settings = StorageUtils.getDefaultSettings();
        }
    }

    async saveSettings() {
        try {
            await StorageUtils.saveSettings(this.settings);
            console.log('✅ 设置已保存');
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            throw error;
        }
    }

    // 🔧 新增：统一的防重复触发检查
    canExecuteAction(actionName, cooldown = this.defaultCooldown) {
        const now = Date.now();
        const lastTime = this.actionCooldowns.get(actionName) || 0;

        if (now - lastTime < cooldown) {
            console.log(`🚫 动作 ${actionName} 触发过于频繁，忽略重复触发`);
            return false;
        }

        this.actionCooldowns.set(actionName, now);
        return true;
    }

    // 🔧 新增：统一的Chrome API检查
    isChromeApiAvailable() {
        return typeof chrome !== 'undefined' && chrome.tabs && chrome.tabGroups;
    }

    // 🔧 新增：统一的错误处理包装器
    async executeWithErrorHandling(actionName, asyncFunction) {
        if (!this.canExecuteAction(actionName)) return null;

        if (!this.isInitialized || !this.settings.enabled) {
            console.warn(`${actionName} 功能未启用或未初始化`);
            return null;
        }

        try {
            return await asyncFunction();
        } catch (error) {
            console.error(`❌ ${actionName} 失败:`, error);
            throw error;
        }
    }

    /**
     * 按域名分组标签页
     */
    async groupTabsByDomain() {
        return this.executeWithErrorHandling('标签分组', async () => {
            console.log('🔄 开始执行标签分组...');

            // 检查Chrome API可用性
            if (!this.isChromeApiAvailable()) {
                throw new Error('Chrome扩展API不可用');
            }

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});

            // 按域名分组
            const domainGroups = this.groupTabsByDomainLogic(tabs);

            if (Object.keys(domainGroups).length === 0) {
                console.log('没有找到可分组的标签页');
                return { success: true, groupCount: 0 };
            }

            // 创建标签分组
            const result = await this.createTabGroups(domainGroups);
            console.log('✅ 标签分组完成');

            return { success: true, groupCount: Object.keys(domainGroups).length, ...result };
        });
    }

    /**
     * 标签页分组逻辑
     */
    groupTabsByDomainLogic(tabs) {
        const groups = {};

        tabs.forEach(tab => {
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                return;
            }

            try {
                const domain = DomainUtils.getDomainDisplayName(tab.url);
                
                if (!groups[domain]) {
                    groups[domain] = [];
                }
                groups[domain].push(tab);
            } catch (error) {
                console.warn('解析标签页域名失败:', tab.url, error);
            }
        });

        // 过滤掉只有一个标签页的域名（根据设置）
        if (this.settings.grouping.minTabsToGroup > 1) {
            Object.keys(groups).forEach(domain => {
                if (groups[domain].length < this.settings.grouping.minTabsToGroup) {
                    delete groups[domain];
                }
            });
        }

        return groups;
    }

    // 🔧 新增：标签分组颜色管理
    getGroupColors() {
        return ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    }

    /**
     * 创建标签分组
     */
    async createTabGroups(domainGroups) {
        const colors = this.getGroupColors();
        let colorIndex = 0;
        const results = { created: 0, failed: 0, errors: [] };

        for (const [domain, tabs] of Object.entries(domainGroups)) {
            try {
                // 获取标签页ID
                const tabIds = tabs.map(tab => tab.id);

                // 创建分组
                const group = await chrome.tabGroups.group({ tabIds });

                // 设置分组属性
                await chrome.tabGroups.update(group, {
                    title: domain,
                    color: colors[colorIndex % colors.length],
                    collapsed: this.settings.grouping?.autoCollapse || false
                });

                colorIndex++;
                results.created++;
                console.log(`📁 已创建分组: ${domain} (${tabs.length}个标签页)`);
            } catch (error) {
                results.failed++;
                results.errors.push({ domain, error: error.message });
                console.error(`创建分组失败: ${domain}`, error);
            }
        }

        return results;
    }

    /**
     * 去重标签页
     */
    async deduplicateTabs() {
        return this.executeWithErrorHandling('标签去重', async () => {
            console.log('🔄 开始执行标签页去重...');

            // 检查Chrome API可用性
            if (!this.isChromeApiAvailable()) {
                throw new Error('Chrome扩展API不可用');
            }

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});

            // 查找重复标签页
            const duplicates = this.findDuplicateTabs(tabs);

            if (duplicates.length === 0) {
                console.log('没有找到重复的标签页');
                return { success: true, closedCount: 0 };
            }

            // 关闭重复标签页
            await this.closeDuplicateTabs(duplicates);
            console.log(`✅ 标签页去重完成，关闭了 ${duplicates.length} 个重复标签页`);

            return { success: true, closedCount: duplicates.length };
        });
    }

    /**
     * 查找重复标签页
     */
    findDuplicateTabs(tabs) {
        const urlMap = new Map();
        const duplicates = [];

        tabs.forEach(tab => {
            if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                return;
            }

            // 根据设置决定是否忽略URL参数
            let compareUrl = tab.url;
            if (this.settings.deduplication.ignoreUrlParams) {
                try {
                    const url = new URL(tab.url);
                    compareUrl = `${url.protocol}//${url.host}${url.pathname}`;
                } catch (error) {
                    // 如果URL解析失败，使用原始URL
                    compareUrl = tab.url;
                }
            }

            if (urlMap.has(compareUrl)) {
                // 找到重复，决定保留哪个
                const existingTab = urlMap.get(compareUrl);
                const tabToClose = this.decideDuplicateTab(existingTab, tab);
                duplicates.push(tabToClose);
            } else {
                urlMap.set(compareUrl, tab);
            }
        });

        return duplicates;
    }

    /**
     * 决定关闭哪个重复标签页
     */
    decideDuplicateTab(tab1, tab2) {
        // 优先保留活跃标签页
        if (tab1.active) return tab2;
        if (tab2.active) return tab1;

        // 优先保留固定标签页
        if (tab1.pinned && !tab2.pinned) return tab2;
        if (tab2.pinned && !tab1.pinned) return tab1;

        // 根据设置决定保留策略
        switch (this.settings.deduplication.keepStrategy) {
            case 'newest':
                return tab1.id < tab2.id ? tab1 : tab2;
            case 'oldest':
                return tab1.id > tab2.id ? tab1 : tab2;
            case 'leftmost':
                return tab1.index > tab2.index ? tab1 : tab2;
            case 'rightmost':
                return tab1.index < tab2.index ? tab1 : tab2;
            default:
                return tab2; // 默认保留第一个
        }
    }

    /**
     * 关闭重复标签页
     */
    async closeDuplicateTabs(duplicates) {
        const tabIds = duplicates.map(tab => tab.id);
        
        if (tabIds.length > 0) {
            await chrome.tabs.remove(tabIds);
        }
    }

    // 🔧 新增：过滤有效标签页URL的通用方法
    filterValidTabUrls(tabs) {
        return tabs
            .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://'))
            .map(tab => tab.url);
    }

    // 🔧 新增：复制到剪贴板的通用方法
    async copyToClipboard(text) {
        if (!navigator.clipboard) {
            throw new Error('剪贴板API不可用');
        }
        await navigator.clipboard.writeText(text);
    }

    /**
     * 复制当前标签页
     */
    async copyCurrentTab() {
        return this.executeWithErrorHandling('复制当前标签页', async () => {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!currentTab?.url) {
                throw new Error('未找到当前活动标签页');
            }

            await this.copyToClipboard(currentTab.url);
            console.log('✅ 已复制当前标签页URL:', currentTab.url);

            return { success: true, url: currentTab.url };
        });
    }

    /**
     * 复制所有标签页
     */
    async copyAllTabs() {
        return this.executeWithErrorHandling('复制所有标签页', async () => {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const urls = this.filterValidTabUrls(tabs);

            if (urls.length === 0) {
                throw new Error('没有找到有效的标签页URL');
            }

            const urlText = urls.join('\n');
            await this.copyToClipboard(urlText);
            console.log(`✅ 已复制 ${urls.length} 个标签页URL`);

            return { success: true, count: urls.length, urls };
        });
    }

    /**
     * 获取用户快捷键设置
     */
    getUserShortcuts() {
        return this.settings.shortcuts || {
            group: 'Ctrl+M',
            dedupe: 'Ctrl+Shift+M',
            copy: 'Ctrl+K'
        };
    }

    /**
     * 更新用户快捷键设置
     */
    async updateUserShortcuts(shortcuts) {
        this.settings.shortcuts = shortcuts;
        await this.saveSettings();
        
        // 通知content script更新快捷键
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'shortcutsUpdated',
                    shortcuts: shortcuts
                });
            } catch (error) {
                // 忽略无法发送消息的标签页
            }
        }
    }
}
