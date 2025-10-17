/**
 * Moment-Unified Background Script
 * 处理扩展程序的后台逻辑和侧边栏管理
 * 合并了链接预览和标签管理功能
 */

// 用户快捷键设置缓存（TabManager功能）
let userShortcuts = {
    group: 'Ctrl+M',
    dedupe: 'Ctrl+Shift+M',
    copy: 'Ctrl+K',
    ungroup: 'Ctrl+Shift+K'
};

// 扩展程序安装时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('🚀 Moment-Unified 扩展程序已安装');

    try {
        // 初始化默认设置
        await initializeDefaultSettings();

        // 初始化TabManager设置
        await initializeTabManagerSettings();

        // 配置侧边栏（安装和更新时都需要）
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

        if (details.reason === 'update') {
            console.log('🔄 扩展已更新到版本:', chrome.runtime.getManifest().version);
        }
    } catch (error) {
        console.error('❌ 扩展初始化失败:', error);
    }
});

// 初始化TabManager设置
async function initializeTabManagerSettings() {
    try {
        // 加载用户快捷键设置
        await loadUserShortcuts();
        console.log('✅ TabManager初始化完成');
    } catch (error) {
        console.error('❌ TabManager初始化失败:', error);
    }
}

// 加载用户快捷键设置
async function loadUserShortcuts() {
    try {
        // 从chrome.storage.local获取设置
        const result = await chrome.storage.local.get(['moment-tab-shortcuts']);

        if (result['moment-tab-shortcuts']) {
            const savedShortcuts = result['moment-tab-shortcuts'];
            userShortcuts = { ...userShortcuts, ...savedShortcuts };
        }

        console.log('📋 加载用户快捷键设置:', userShortcuts);

        // 通知所有content script更新快捷键
        await updateContentScriptShortcuts();
    } catch (error) {
        console.warn('加载用户快捷键设置失败:', error);
    }
}

// 更新所有content script的快捷键设置
async function updateContentScriptShortcuts() {
    try {
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'shortcutsUpdated',
                shortcuts: userShortcuts
            }).catch(() => {
                // 忽略无法发送消息的标签页（如chrome://页面）
            });
        });
    } catch (error) {
        console.warn('更新content script快捷键失败:', error);
    }
}

// 监听设置变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes['moment-tab-shortcuts']) {
        loadUserShortcuts();
    }
});



// 初始化默认设置
async function initializeDefaultSettings() {
    try {
        const result = await chrome.storage.local.get(['linkWindowSettings']);

        if (!result.linkWindowSettings) {
            const defaultSettings = {
                linkPreview: {
                    enabled: true,
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
                    },
                    textActions: {
                        enabled: true,
                        directions: {
                            up: 'search',
                            down: 'translate',
                            left: 'search',
                            right: 'search'
                        },
                        searchEngine: 'baidu',
                        translateEngine: 'baidu',
                        targetLanguage: 'zh'
                    }
                }
            };
            
            await chrome.storage.local.set({ linkWindowSettings: defaultSettings });
            console.log('✅ 默认设置已初始化');
        }
    } catch (error) {
        console.error('❌ 初始化设置失败:', error);
    }
}

// 处理扩展程序图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // 打开侧边栏
        await chrome.sidePanel.open({ tabId: tab.id });
        console.log('📱 侧边栏已打开');
    } catch (error) {
        console.error('❌ 打开侧边栏失败:', error);
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('📨 收到消息:', request);

    // 处理LinkWindow消息
    switch (request.type) {
        case 'getSettings':
            handleGetSettings(sendResponse);
            return true; // 保持消息通道开放

        case 'updateSettings':
            handleUpdateSettings(request.settings, sendResponse);
            return true;

        case 'updateMemoryConfig':
            handleUpdateMemoryConfig(request.memory, sendResponse);
            return true;

        case 'createCrossTabPreview':
            handleCreateCrossTabPreview(request.data, sendResponse);
            return true;

        case 'injectIframeScript':
            handleInjectIframeScript(request.data, _sender, sendResponse);
            return true;

        case 'reinjectAllIframeScripts':
            handleReinjectAllIframeScripts(request.data, _sender, sendResponse);
            return true;
    }

    // 处理TabManager消息
    switch (request.action) {
        case 'groupTabs':
            handleTabAction('groupTabs', sendResponse);
            return true;

        case 'ungroupTabs':
            handleTabAction('ungroupTabs', sendResponse);
            return true;

        case 'deduplicateTabs':
            handleTabAction('deduplicateTabs', sendResponse);
            return true;

        case 'copyCurrentTab':
            handleTabAction('copyCurrentTab', sendResponse);
            return true;

        case 'copyAllTabs':
            handleTabAction('copyAllTabs', sendResponse);
            return true;

        case 'getUserShortcuts':
            sendResponse({ shortcuts: userShortcuts });
            return true;

        case 'updateShortcuts':
            handleUpdateShortcuts(request.shortcuts, sendResponse);
            return true;



        case 'ping':
            sendResponse({ success: true, message: 'pong', timestamp: Date.now() });
            return true;

        default:
            if (!request.type && !request.action) {
                console.warn('⚠️ 未知的消息类型:', request);
                sendResponse({ success: false, error: 'Unknown message type' });
            }
    }
});

// 获取设置
async function handleGetSettings(sendResponse) {
    try {
        const result = await chrome.storage.local.get(['linkWindowSettings']);
        sendResponse({
            success: true,
            settings: result.linkWindowSettings
        });
    } catch (error) {
        handleError('获取设置', error, sendResponse);
    }
}

// 通用错误处理函数
function handleError(operation, error, sendResponse = null) {
    console.error(`❌ ${operation}失败:`, error);
    if (sendResponse) {
        sendResponse({ success: false, error: error.message });
    }
}

// 通知所有标签页设置更新的通用方法
async function notifySettingsUpdate(settings) {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        try {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'settingsUpdated',
                settings: settings
            });
        } catch (error) {
            // 忽略无法发送消息的标签页（如chrome://页面）
        }
    }
}

// 更新设置
async function handleUpdateSettings(settings, sendResponse) {
    try {
        await chrome.storage.local.set({ linkWindowSettings: settings });
        await notifySettingsUpdate(settings);

        sendResponse({ success: true });
        console.log('✅ 设置已更新并同步到所有标签页');
    } catch (error) {
        handleError('更新设置', error, sendResponse);
    }
}

// 更新记忆配置
async function handleUpdateMemoryConfig(memory, sendResponse) {
    try {
        // 获取当前设置
        const result = await chrome.storage.local.get('linkWindowSettings');
        const currentSettings = result.linkWindowSettings || getDefaultSettings();

        // 更新记忆配置
        if (!currentSettings.linkPreview) {
            currentSettings.linkPreview = {};
        }
        currentSettings.linkPreview.memory = memory;

        // 保存更新后的设置
        await chrome.storage.local.set({ linkWindowSettings: currentSettings });

        console.log('✅ 记忆配置更新成功:', memory);
        sendResponse({ success: true });
    } catch (error) {
        handleError('更新记忆配置', error, sendResponse);
    }
}

// 创建跨标签页预览窗口
async function handleCreateCrossTabPreview(data, sendResponse) {
    try {
        const { url, options } = data;

        // 在URL中添加特殊参数来标识这是跨标签页预览窗口
        const separator = url.includes('?') ? '&' : '?';
        const markedUrl = `${url}${separator}__moment_linkwindow_cross_tab=1`;

        // 创建新的浏览器窗口
        const window = await chrome.windows.create({
            url: markedUrl,
            type: 'popup',
            width: options.width || 700,
            height: options.height || 800,
            left: options.left || 100,
            top: options.top || 100
        });

        // 等待窗口加载完成后检查并注入内容脚本
        setTimeout(async () => {
            try {
                const tabs = await chrome.tabs.query({ windowId: window.id });
                if (tabs.length > 0) {
                    const tabId = tabs[0].id;

                    // 检查是否已经有内容脚本（避免重复注入）
                    const hasContentScript = await checkContentScriptExists(tabId);

                    if (!hasContentScript) {
                        console.log('🔧 跨标签页窗口需要注入内容脚本:', tabId);

                        // 按正确顺序注入所有必要的脚本和样式
                        await chrome.scripting.insertCSS({
                            target: { tabId: tabId },
                            files: ['css/link-preview.css']
                        });

                        await chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            files: [
                                'content-scripts/global-shortcuts.js',
                                'content-scripts/text-drag-config.js',
                                'content-scripts/link-preview.js'
                            ]
                        });

                        console.log('✅ 跨标签页窗口内容脚本已注入:', tabId);
                    } else {
                        console.log('ℹ️ 跨标签页窗口内容脚本已存在，跳过注入:', tabId);
                    }
                }
            } catch (error) {
                console.log('⚠️ 跨标签页窗口内容脚本处理失败:', error.message);
            }
        }, 1500); // 增加延迟确保页面完全加载

        sendResponse({
            success: true,
            windowId: window.id
        });
        console.log('🪟 跨标签页预览窗口已创建:', window.id);
    } catch (error) {
        handleError('创建跨标签页预览窗口', error, sendResponse);
    }
}

// 检查标签页是否已经有内容脚本（优化：减少检查项目）
async function checkContentScriptExists(tabId) {
    try {
        // 优化：只检查主要的标识符，减少执行时间
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // 检查关键的内容脚本标识（优化：减少检查项）
                return typeof window.linkWindowPreviewManager !== 'undefined';
            }
        });

        return results && results[0] && results[0].result === true;
    } catch (error) {
        // 如果执行失败，假设没有内容脚本
        console.log('🔍 内容脚本检查失败，将进行注入:', error.message);
        return false;
    }
}

// 监听存储变化，同步设置到所有标签页
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.linkWindowSettings) {
        const newSettings = changes.linkWindowSettings.newValue;
        await notifySettingsUpdate(newSettings);
        console.log('🔄 设置变化已同步到所有标签页');
    }
});

// ===== TabManager 功能处理函数 =====

// 🔧 优化：使用单例模式的标签管理器实例
let tabManagerInstance = null;

// 获取标签管理器实例
function getTabManager() {
    if (!tabManagerInstance) {
        tabManagerInstance = new TabManager();
    }
    return tabManagerInstance;
}

// 🔧 优化：简化的标签操作处理器
async function handleTabAction(action, sendResponse) {
    console.log(`🔥 收到标签操作请求: ${action}`);

    try {
        const tabManager = getTabManager();

        // 🔧 优化：使用映射表简化操作分发
        const actionMap = {
            'groupTabs': () => tabManager.groupTabsByDomain(),
            'ungroupTabs': () => tabManager.ungroupAllTabs(),
            'deduplicateTabs': () => tabManager.deduplicateTabs(),
            'copyCurrentTab': () => tabManager.copyCurrentTab(),
            'copyAllTabs': () => tabManager.copyAllTabs()
        };

        const actionHandler = actionMap[action];
        if (!actionHandler) {
            throw new Error(`未知的标签操作: ${action}`);
        }

        const result = await actionHandler();
        sendResponse({ success: true, result });
    } catch (error) {
        console.error(`❌ 标签操作失败 (${action}):`, error);
        sendResponse({ success: false, error: error.message });
    }
}

// 处理快捷键更新
async function handleUpdateShortcuts(shortcuts, sendResponse) {
    try {
        // 更新内存中的快捷键设置
        userShortcuts = { ...userShortcuts, ...shortcuts };

        // 🔧 修复：在 service worker 环境中直接使用 chrome.storage
        // 因为 service worker 无法导入 StorageUtils
        await chrome.storage.local.set({ 'moment-tab-shortcuts': userShortcuts });

        // 通知所有标签页更新快捷键
        await updateContentScriptShortcuts();

        sendResponse({ success: true });
        console.log('✅ 快捷键已更新:', userShortcuts);
    } catch (error) {
        handleError('更新快捷键', error, sendResponse);
    }
}



// ===== TabManager 类实现 =====
// 🔧 注意：这是 background.js 中的 TabManager 类副本
// 由于 service worker 环境限制，无法直接导入 js/tab-manager.js
// 请确保与 js/tab-manager.js 中的接口保持一致

class TabManager {
    constructor() {
        console.log('🔧 TabManager 构造函数被调用');

        // 🔧 优化：使用统一的防重复触发机制
        this.actionCooldowns = new Map();
        this.defaultCooldown = 100; // 100ms内不允许重复触发

        console.log('✅ TabManager 初始化完成');
    }

    // 通用方法：检查是否为有效标签页
    isValidTab(tab) {
        return tab.url &&
               !tab.url.startsWith('chrome://') &&
               !tab.url.startsWith('chrome-extension://');
    }

    // 通用方法：防重复触发检查
    checkCooldown() {
        const now = Date.now();
        if (now - this.lastTriggerTime < this.triggerCooldown) {
            console.log('🚫 操作触发过于频繁，忽略重复触发');
            return false;
        }
        this.lastTriggerTime = now;
        return true;
    }

    async groupTabsByDomain() {
        if (!this.checkCooldown()) {
            return { success: false, error: '触发过于频繁' };
        }

        try {
            console.log('🔄 开始执行标签分组...');

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});
            console.log(`📋 获取到 ${tabs.length} 个标签页`);

            // 按域名分组
            const domainGroups = this.groupTabsByDomainLogic(tabs);

            if (Object.keys(domainGroups).length === 0) {
                console.log('没有找到可分组的标签页');
                return { success: true, message: '没有找到可分组的标签页', groupCount: 0 };
            }

            // 创建标签分组
            await this.createTabGroups(domainGroups);
            const groupCount = Object.keys(domainGroups).length;

            console.log(`✅ 标签分组完成，创建了 ${groupCount} 个分组`);
            return { success: true, message: `创建了 ${groupCount} 个分组`, groupCount };
        } catch (error) {
            console.error('❌ 标签分组失败:', error);
            return { success: false, error: error.message };
        }
    }

    groupTabsByDomainLogic(tabs) {
        const groups = {};

        tabs.forEach(tab => {
            if (!this.isValidTab(tab)) {
                return;
            }

            try {
                const url = new URL(tab.url);
                const hostname = url.hostname;
                const simplifiedDomain = this.simplifyDomainName(hostname);

                if (!groups[simplifiedDomain]) {
                    groups[simplifiedDomain] = [];
                }
                groups[simplifiedDomain].push(tab);
            } catch (error) {
                console.warn('无法解析URL:', tab.url);
            }
        });

        // 过滤只有一个标签的域名，使用更高效的方法
        for (const [domain, tabList] of Object.entries(groups)) {
            if (tabList.length < 2) {
                delete groups[domain];
            }
        }

        console.log(`📊 找到 ${Object.keys(groups).length} 个可分组的域名:`,
            Object.keys(groups).map(domain => `${domain}: ${groups[domain].length}个`));

        return groups;
    }

    simplifyDomainName(hostname) {
        if (!hostname) return hostname;

        let domain = hostname.replace(/^www\./, '');
        const parts = domain.split('.');

        if (parts.length >= 2) {
            const secondLastPart = parts[parts.length - 2];
            const specialSuffixes = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];

            if (parts.length >= 3 && specialSuffixes.includes(secondLastPart)) {
                return parts[parts.length - 3];
            } else {
                return secondLastPart;
            }
        }

        return domain;
    }

    async createTabGroups(domainGroups) {
        const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

        for (const [domain, tabs] of Object.entries(domainGroups)) {
            try {
                const tabIds = tabs.map(tab => tab.id);

                // 创建标签分组
                const groupId = await chrome.tabs.group({ tabIds });

                // 设置分组属性
                const hash = domain.split('').reduce((a, b) => {
                    a = ((a << 5) - a) + b.charCodeAt(0);
                    return a & a;
                }, 0);
                const color = colors[Math.abs(hash) % colors.length];

                await chrome.tabGroups.update(groupId, {
                    title: domain,
                    color: color
                });

                console.log(`✅ 已创建分组: ${domain} (${tabs.length} 个标签)`);
            } catch (error) {
                console.error(`创建分组失败 ${domain}:`, error);
            }
        }
    }

    async ungroupAllTabs() {
        try {
            console.log('🔄 开始取消所有标签分组...');

            // 获取所有标签分组
            const groups = await chrome.tabGroups.query({});

            if (groups.length === 0) {
                console.log('没有找到标签分组');
                return { success: true, message: '没有找到标签分组', ungroupCount: 0 };
            }

            let ungroupCount = 0;
            for (const group of groups) {
                try {
                    // 获取分组中的标签页
                    const tabs = await chrome.tabs.query({ groupId: group.id });

                    // 取消分组
                    const tabIds = tabs.map(tab => tab.id);
                    await chrome.tabs.ungroup(tabIds);

                    ungroupCount++;
                    console.log(`📂 已取消分组: ${group.title} (${tabs.length}个标签页)`);
                } catch (error) {
                    console.error(`取消分组失败: ${group.title}`, error);
                }
            }

            console.log(`✅ 取消分组完成，处理了 ${ungroupCount} 个分组`);
            return { success: true, message: `取消了 ${ungroupCount} 个分组`, ungroupCount };
        } catch (error) {
            console.error('❌ 取消分组失败:', error);
            return { success: false, error: error.message };
        }
    }

    async deduplicateTabs() {
        if (!this.checkCooldown()) {
            return { success: false, error: '触发过于频繁' };
        }

        try {
            console.log('🔄 开始执行标签页去重...');

            // 获取所有标签页
            const tabs = await chrome.tabs.query({});

            // 查找重复的标签页
            const urlMap = new Map();
            const duplicates = [];

            tabs.forEach(tab => {
                if (this.isValidTab(tab)) {
                    if (urlMap.has(tab.url)) {
                        duplicates.push(tab);
                    } else {
                        urlMap.set(tab.url, tab);
                    }
                }
            });

            if (duplicates.length === 0) {
                console.log('没有找到重复的标签页');
                return { success: true, message: '没有找到重复的标签页', count: 0 };
            }

            // 关闭重复的标签页
            const tabIds = duplicates.map(tab => tab.id);
            await chrome.tabs.remove(tabIds);

            console.log(`✅ 已去重 ${duplicates.length} 个重复标签页`);
            return { success: true, message: `已去重 ${duplicates.length} 个重复标签页`, count: duplicates.length };
        } catch (error) {
            console.error('❌ 标签页去重失败:', error);
            return { success: false, error: error.message };
        }
    }



    async copyCurrentTab() {
        try {
            const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!currentTab || !this.isValidTab(currentTab)) {
                return { success: false, error: '无法获取当前标签页或标签页无效' };
            }

            // 复制标题和URL
            const content = `${currentTab.title}\n${currentTab.url}`;

            // 在当前标签页中执行复制
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                func: (text) => {
                    navigator.clipboard.writeText(text).then(() => {
                        console.log('✅ 已复制到剪贴板');
                    }).catch(error => {
                        console.error('复制失败:', error);
                    });
                },
                args: [content]
            });

            console.log('✅ 已复制当前标签页:', currentTab.title);
            return { success: true, title: currentTab.title, url: currentTab.url };
        } catch (error) {
            console.error('❌ 复制当前标签页失败:', error);
            return { success: false, error: error.message };
        }
    }

    async copyAllTabs() {
        try {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const validTabs = tabs.filter(tab => this.isValidTab(tab));

            if (validTabs.length === 0) {
                return { success: false, error: '没有找到可复制的标签页' };
            }

            // 复制所有标签页的标题和URL
            const content = validTabs.map(tab => `${tab.title}\n${tab.url}`).join('\n\n');

            // 找到活跃标签页用于执行复制操作
            const activeTab = tabs.find(tab => tab.active);
            if (activeTab) {
                await chrome.scripting.executeScript({
                    target: { tabId: activeTab.id },
                    func: (text) => {
                        navigator.clipboard.writeText(text).then(() => {
                            console.log('✅ 已复制到剪贴板');
                        }).catch(error => {
                            console.error('复制失败:', error);
                        });
                    },
                    args: [content]
                });
            }

            console.log(`✅ 已复制 ${validTabs.length} 个标签页`);
            return { success: true, count: validTabs.length };
        } catch (error) {
            console.error('❌ 复制所有标签页失败:', error);
            return { success: false, error: error.message };
        }
    }


}

// 创建iframe监听器注入函数
function createIframeListenerInjector() {
    return (parentWindowId, triggerConfig, delay) => {
        // 防止重复注入
        if (window.momentLinkWindowIframeListenerInjected) {
            return;
        }
        window.momentLinkWindowIframeListenerInjected = true;

        console.log('🔗 iframe脚本已注入，父窗口ID:', parentWindowId);

        // 存储配置
        window.momentLinkWindowTriggerConfig = {
            method: triggerConfig.method,
            key: triggerConfig.key,
            checkExpression: triggerConfig.checkExpression,
            delay: delay
        };

        // 🔧 优化：在所有函数定义完成后初始化文字拖拽功能
        // initializeIframeTextDragSupport(parentWindowId); // 移动到函数末尾

        // 通用链接检查函数
        const isValidLink = (link) => {
            return link && link.href &&
                   !link.href.startsWith('javascript:') &&
                   !link.href.startsWith('mailto:') &&
                   !link.href.startsWith('#');
        };

        // 通用消息发送函数
        const sendLinkMessage = (url, triggerPosition = null) => {
            window.parent.postMessage({
                type: 'momentLinkWindowLinkClick',
                url: url,
                parentWindowId: parentWindowId,
                triggerPosition: triggerPosition,
                timestamp: Date.now()
            }, '*');
        };

        // 修饰键检查函数
        const isModifierPressed = (event) => {
            try {
                return eval(triggerConfig.checkExpression);
            } catch (error) {
                console.error('修饰键检查表达式错误:', error);
                return event.altKey; // 默认使用Alt键
            }
        };

        // 状态管理变量
        let hoverTimer = null;
        let longPressTimer = null;
        let dragState = {
            isActive: false,
            startTime: 0,
            startX: 0,
            startY: 0,
            currentLink: null
        };
        let hoveredLink = null;
        let isModifierKeyPressed = false;

        // 清理函数
        const clearHoverState = () => {
            if (hoverTimer) {
                clearTimeout(hoverTimer);
                hoverTimer = null;
            }
        };

        const clearLongPressState = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        const clearDragState = () => {
            dragState.isActive = false;
            dragState.startTime = 0;
            dragState.startX = 0;
            dragState.startY = 0;
            dragState.currentLink = null;
        };

        // 根据触发方式绑定事件
        switch (triggerConfig.method) {
            case 'alt+click':
            case 'custom+click':
                document.addEventListener('click', function(e) {
                    if (!isModifierPressed(e)) return;

                    const link = e.target.closest('a[href]');
                    if (!isValidLink(link)) return;

                    e.preventDefault();
                    e.stopPropagation();

                    console.log('🔗 iframe内检测到链接点击:', link.href);
                    sendLinkMessage(link.href, { x: e.clientX, y: e.clientY });
                }, true);
                break;

            case 'alt+hover':
                // 自定义快捷键+悬停
                document.addEventListener('keydown', function(e) {
                    if (isModifierPressed(e)) {
                        isModifierKeyPressed = true;
                        if (hoveredLink) {
                            clearHoverState();
                            hoverTimer = setTimeout(() => {
                                console.log('🔗 iframe内检测到快捷键+悬停:', hoveredLink.href);
                                const rect = hoveredLink.getBoundingClientRect();
                                sendLinkMessage(hoveredLink.href, {
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2
                                });
                            }, delay);
                        }
                    }
                }, true);

                document.addEventListener('keyup', function(e) {
                    isModifierKeyPressed = false;
                    clearHoverState();
                }, true);

                document.addEventListener('mouseover', function(e) {
                    const link = e.target.closest('a[href]');
                    if (link && isValidLink(link)) {
                        hoveredLink = link;
                        if (isModifierKeyPressed) {
                            clearHoverState();
                            hoverTimer = setTimeout(() => {
                                console.log('🔗 iframe内检测到快捷键+悬停:', link.href);
                                const rect = link.getBoundingClientRect();
                                sendLinkMessage(link.href, {
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2
                                });
                            }, delay);
                        }
                    }
                }, true);

                document.addEventListener('mouseout', function(e) {
                    hoveredLink = null;
                    clearHoverState();
                }, true);
                break;

            case 'hover':
                // 纯悬停
                document.addEventListener('mouseover', function(e) {
                    const link = e.target.closest('a[href]');
                    if (!link || !isValidLink(link)) return;

                    clearHoverState();
                    hoverTimer = setTimeout(() => {
                        console.log('🔗 iframe内检测到悬停:', link.href);
                        const rect = link.getBoundingClientRect();
                        sendLinkMessage(link.href, {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2
                        });
                    }, delay);
                }, true);

                document.addEventListener('mouseout', function(e) {
                    clearHoverState();
                }, true);
                break;

            case 'longpress':
                // 长按
                document.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return; // 只处理左键

                    const link = e.target.closest('a[href]');
                    if (!link || !isValidLink(link)) return;

                    clearLongPressState();
                    longPressTimer = setTimeout(() => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔗 iframe内检测到长按:', link.href);
                        sendLinkMessage(link.href, { x: e.clientX, y: e.clientY });
                    }, delay);
                }, true);

                document.addEventListener('mouseup', function(e) {
                    clearLongPressState();
                }, true);

                document.addEventListener('mousemove', function(e) {
                    clearLongPressState();
                }, true);
                break;

            case 'drag':
                // 拖拽
                document.addEventListener('mousedown', function(e) {
                    if (e.button !== 0) return;

                    const link = e.target.closest('a[href]');
                    if (!link) return;

                    clearDragState();
                    dragState.isActive = true;
                    dragState.startTime = Date.now();
                    dragState.startX = e.clientX;
                    dragState.startY = e.clientY;
                    dragState.currentLink = link;
                }, true);

                document.addEventListener('mousemove', function(e) {
                    if (!dragState.isActive) return;

                    const distance = Math.sqrt(
                        Math.pow(e.clientX - dragState.startX, 2) +
                        Math.pow(e.clientY - dragState.startY, 2)
                    );

                    if (distance > 10) { // 拖拽阈值
                        const dragTime = Date.now() - dragState.startTime;
                        if (dragTime > 100) { // 最小拖拽时间
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔗 iframe内检测到拖拽:', dragState.currentLink.href);
                            sendLinkMessage(dragState.currentLink.href, { x: e.clientX, y: e.clientY });
                            clearDragState();
                        }
                    }
                }, true);

                document.addEventListener('mouseup', function(e) {
                    clearDragState();
                }, true);
                break;

            default:
                // 默认使用点击
                document.addEventListener('click', function(e) {
                    if (!isModifierPressed(e)) return;

                    const link = e.target.closest('a[href]');
                    if (!isValidLink(link)) return;

                    e.preventDefault();
                    e.stopPropagation();

                    console.log('🔗 iframe内检测到链接点击:', link.href);
                    sendLinkMessage(link.href, { x: e.clientX, y: e.clientY });
                }, true);
                break;
        }

        console.log('✅ iframe事件监听器已绑定，触发方式:', triggerConfig.method);

        // 🔧 优化：初始化iframe文字拖拽功能（移动到此处确保函数定义顺序正确）
        initializeIframeTextDragSupport(parentWindowId);

        // 🔧 优化：iframe文字拖拽功能初始化（简化实现，复用核心逻辑）
        function initializeIframeTextDragSupport(parentWindowId) {
            // 🔧 优化：使用常量避免重复定义
            const DRAG_THRESHOLD = 20;
            const DRAG_TIMEOUT = 1000;

            // 🔧 优化：简化工具函数，只保留必要的
            const calculateDistance = (start, end) =>
                Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

            const calculateDirection = (start, end) => {
                const deltaX = end.x - start.x;
                const deltaY = end.y - start.y;
                return Math.abs(deltaX) > Math.abs(deltaY)
                    ? (deltaX > 0 ? 'right' : 'left')
                    : (deltaY > 0 ? 'down' : 'up');
            };

            const isClickInSelection = (event, selection) => {
                if (!selection || selection.rangeCount === 0) return false;
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                return event.clientX >= rect.left && event.clientX <= rect.right &&
                       event.clientY >= rect.top && event.clientY <= rect.bottom;
            };

            // 🔧 优化：简化的iframe文字拖拽状态管理
            let dragState = {
                isDragging: false,
                isPotentialDrag: false,
                startPosition: { x: 0, y: 0 },
                selectedText: '',
                dragStartTime: 0,
                dragDistance: 0
            };

            // 🔧 优化：事件处理函数（避免类的开销）
            const resetDragState = (clearText = false) => {
                dragState.isDragging = false;
                dragState.isPotentialDrag = false;
                dragState.dragDistance = 0;
                document.body.style.cursor = '';
                if (clearText) dragState.selectedText = '';
            };

            const handleMouseDown = (e) => {
                if (e.button !== 0) return;

                const selection = window.getSelection();
                if (!selection || selection.isCollapsed) return;

                const selectedText = selection.toString().trim();
                if (!selectedText || selectedText.length < 1) return;

                if (!isClickInSelection(e, selection)) return;

                // 初始化潜在拖拽状态
                dragState.isPotentialDrag = true;
                dragState.startPosition = { x: e.clientX, y: e.clientY };
                dragState.selectedText = selectedText;
                dragState.dragStartTime = Date.now();

                e.preventDefault();
                console.log('🔧 iframe准备文本拖拽:', selectedText.substring(0, 50));
            };

            const handleMouseMove = (e) => {
                if (dragState.isPotentialDrag && !dragState.isDragging) {
                    dragState.dragDistance = calculateDistance(dragState.startPosition, { x: e.clientX, y: e.clientY });
                    if (dragState.dragDistance >= DRAG_THRESHOLD) {
                        dragState.isDragging = true;
                        dragState.isPotentialDrag = false;
                        console.log('🔧 iframe开始真正拖拽，距离:', dragState.dragDistance.toFixed(0) + 'px');
                    }
                }

                if (dragState.isDragging) {
                    document.body.style.cursor = 'grabbing';
                }
            };

            const handleMouseUp = (e) => {
                if (dragState.isDragging) {
                    const dragTime = Date.now() - dragState.dragStartTime;
                    if (dragState.dragDistance >= DRAG_THRESHOLD && dragTime <= DRAG_TIMEOUT) {
                        const direction = calculateDirection(dragState.startPosition, { x: e.clientX, y: e.clientY });
                        executeTextDragAction(direction, dragState.selectedText);
                    }
                    resetDragState();
                } else if (dragState.isPotentialDrag) {
                    resetDragState(true);
                    console.log('🔧 iframe仅点击，未拖拽，取消操作');
                }
            };

            const executeTextDragAction = (direction, text) => {
                console.log('🚀 iframe执行文字拖拽动作:', { direction, text: text.substring(0, 50) });

                // 向父窗口发送文字拖拽消息
                window.parent.postMessage({
                    type: 'momentLinkWindowTextDrag',
                    parentWindowId: parentWindowId,
                    textDragData: {
                        text: text,
                        direction: direction,
                        position: { x: 0, y: 0 } // 简化位置信息
                    },
                    timestamp: Date.now()
                }, '*');
            };

            // 🔧 优化：绑定事件监听器
            document.addEventListener('mousedown', handleMouseDown, true);
            document.addEventListener('mousemove', handleMouseMove, true);
            document.addEventListener('mouseup', handleMouseUp, true);

            console.log('✅ iframe文字拖拽功能已启用');
        }
    };
}

// 处理iframe脚本注入请求
async function handleInjectIframeScript(data, sender, sendResponse) {
    const { url, parentWindowId, triggerConfig, delay } = data || {};
    if (!url || !parentWindowId || !triggerConfig) {
        sendResponse({ success: false, error: 'Missing required parameters' });
        return;
    }

    try {
        // 获取当前标签页ID
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID available' });
            return;
        }

        console.log('🔧 注入iframe脚本到标签页:', tabId, '父窗口ID:', parentWindowId);

        // 使用chrome.scripting.executeScript注入脚本到所有frame
        await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            args: [parentWindowId, triggerConfig, delay],
            func: createIframeListenerInjector()
        });

        console.log('✅ iframe脚本注入成功');
        sendResponse({ success: true });

    } catch (error) {
        console.error('❌ iframe脚本注入失败:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 处理重新注入所有iframe脚本的请求
async function handleReinjectAllIframeScripts(data, sender, sendResponse) {
    const { triggerConfig, delay } = data || {};
    if (!triggerConfig) {
        sendResponse({ success: false, error: 'Missing trigger config' });
        return;
    }

    try {
        // 获取当前标签页ID
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ success: false, error: 'No tab ID available' });
            return;
        }

        console.log('🔧 重新注入iframe脚本到标签页:', tabId);

        // 使用chrome.scripting.executeScript重新注入脚本到所有frame
        await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            args: ['config-update', triggerConfig, delay],
            func: createIframeConfigUpdater()
        });

        console.log('✅ iframe脚本重新注入成功');
        sendResponse({ success: true });

    } catch (error) {
        console.error('❌ iframe脚本重新注入失败:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 创建iframe配置更新器（简化版，避免循环依赖）
function createIframeConfigUpdater() {
    return (parentWindowId, triggerConfig, delay) => {
        // 检查是否已经有配置更新监听器
        if (window.momentLinkWindowConfigUpdateListener) {
            return;
        }

        // 标记已添加配置更新监听器
        window.momentLinkWindowConfigUpdateListener = true;

        console.log('🔄 iframe配置更新监听器已添加');

        // 监听配置更新消息
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'momentLinkWindowConfigUpdate') {
                const { triggerConfig: newConfig, delay: newDelay } = event.data;

                console.log('📨 收到配置更新消息:', newConfig);

                // 更新全局配置
                window.momentLinkWindowTriggerConfig = {
                    method: newConfig.method,
                    key: newConfig.key,
                    checkExpression: newConfig.checkExpression,
                    delay: newDelay
                };

                console.log('✅ iframe触发配置已更新:', window.momentLinkWindowTriggerConfig);

                // 简化的重新绑定：直接标记需要重新注入
                window.momentLinkWindowNeedsRebind = true;
            }
        });
    };
}
