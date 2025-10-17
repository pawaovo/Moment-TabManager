/**
 * 工具类集合
 * 包含域名处理、快捷键解析等通用功能
 */

/**
 * 域名工具类
 */
class DomainUtils {
    /**
     * 简化域名名称，去除常见前缀和后缀
     * @param {string} hostname - 完整的主机名
     * @returns {string} 简化后的域名
     */
    static simplifyDomainName(hostname) {
        if (!hostname) return 'Unknown';

        let domain = hostname.toLowerCase();

        // 移除 www 前缀
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }

        // 移除其他常见前缀
        const prefixes = ['m.', 'mobile.', 'app.', 'api.', 'cdn.', 'static.'];
        for (const prefix of prefixes) {
            if (domain.startsWith(prefix)) {
                domain = domain.substring(prefix.length);
                break;
            }
        }

        // 特殊域名映射
        const domainMappings = {
            'google.com': 'Google',
            'google.com.hk': 'Google',
            'google.cn': 'Google',
            'youtube.com': 'YouTube',
            'github.com': 'GitHub',
            'stackoverflow.com': 'Stack Overflow',
            'zhihu.com': '知乎',
            'baidu.com': '百度',
            'taobao.com': '淘宝',
            'tmall.com': '天猫',
            'jd.com': '京东',
            'weibo.com': '微博',
            'bilibili.com': 'B站',
            'douyin.com': '抖音',
            'tiktok.com': 'TikTok',
            'facebook.com': 'Facebook',
            'twitter.com': 'Twitter',
            'instagram.com': 'Instagram',
            'linkedin.com': 'LinkedIn',
            'reddit.com': 'Reddit',
            'amazon.com': 'Amazon',
            'netflix.com': 'Netflix',
            'microsoft.com': 'Microsoft',
            'apple.com': 'Apple',
            'openai.com': 'OpenAI',
            'chatgpt.com': 'ChatGPT'
        };

        // 检查是否有特殊映射
        if (domainMappings[domain]) {
            return domainMappings[domain];
        }

        // 提取主域名（去除子域名）
        const parts = domain.split('.');
        if (parts.length >= 2) {
            // 对于常见的二级域名，保留最后两部分
            const tld = parts[parts.length - 1];
            const sld = parts[parts.length - 2];
            
            // 特殊处理一些国家域名
            const countryTlds = ['co.uk', 'com.cn', 'com.au', 'co.jp', 'co.kr'];
            if (parts.length >= 3) {
                const lastTwo = `${sld}.${tld}`;
                if (countryTlds.includes(lastTwo)) {
                    return parts[parts.length - 3];
                }
            }
            
            return sld;
        }

        return domain;
    }

    /**
     * 获取域名的显示名称
     * @param {string} url - 完整的URL
     * @returns {string} 域名显示名称
     */
    static getDomainDisplayName(url) {
        try {
            const urlObj = new URL(url);
            return this.simplifyDomainName(urlObj.hostname);
        } catch (error) {
            return 'Unknown';
        }
    }
}

/**
 * 快捷键工具类
 */
class ShortcutUtils {
    /**
     * 解析快捷键字符串
     * @param {string} shortcutStr - 快捷键字符串，如 "Ctrl+Shift+M"
     * @returns {Object} 解析后的快捷键对象
     */
    static parseShortcut(shortcutStr) {
        const parts = shortcutStr.split('+').map(part => part.trim());
        const result = {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            key: ''
        };

        parts.forEach(part => {
            const lowerPart = part.toLowerCase();
            switch (lowerPart) {
                case 'ctrl':
                case 'control':
                    result.ctrl = true;
                    break;
                case 'shift':
                    result.shift = true;
                    break;
                case 'alt':
                    result.alt = true;
                    break;
                case 'meta':
                case 'cmd':
                case 'command':
                    result.meta = true;
                    break;
                default:
                    if (part.length === 1) {
                        result.key = part.toUpperCase();
                    }
                    break;
            }
        });

        return result;
    }

    /**
     * 检查快捷键是否匹配
     * @param {KeyboardEvent} event - 键盘事件
     * @param {string} shortcutStr - 快捷键字符串
     * @returns {boolean} 是否匹配
     */
    static isShortcutMatch(event, shortcutStr) {
        const shortcut = this.parseShortcut(shortcutStr);
        
        return event.ctrlKey === shortcut.ctrl &&
               event.shiftKey === shortcut.shift &&
               event.altKey === shortcut.alt &&
               event.metaKey === shortcut.meta &&
               event.key.toUpperCase() === shortcut.key;
    }

    /**
     * 将键盘事件转换为快捷键字符串
     * @param {KeyboardEvent} event - 键盘事件
     * @returns {string} 快捷键字符串
     */
    static eventToShortcutString(event) {
        const parts = [];
        
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        if (event.metaKey) parts.push('Meta');
        
        if (event.key && event.key.length === 1 && /[A-Za-z0-9]/.test(event.key)) {
            parts.push(event.key.toUpperCase());
        }
        
        return parts.join('+');
    }

    /**
     * 验证快捷键是否有效
     * @param {string} shortcutStr - 快捷键字符串
     * @returns {boolean} 是否有效
     */
    static isValidShortcut(shortcutStr) {
        if (!shortcutStr || typeof shortcutStr !== 'string') {
            return false;
        }

        const shortcut = this.parseShortcut(shortcutStr);
        
        // 必须有修饰键
        if (!shortcut.ctrl && !shortcut.shift && !shortcut.alt && !shortcut.meta) {
            return false;
        }
        
        // 必须有字母或数字键
        if (!shortcut.key || !/[A-Z0-9]/.test(shortcut.key)) {
            return false;
        }
        
        return true;
    }
}

/**
 * 存储工具类 - 统一的存储管理
 */
class StorageUtils {
    // 🔧 优化：统一存储键名常量
    static STORAGE_KEYS = {
        TAB_MANAGER_SETTINGS: 'moment-tab-manager-settings',
        TAB_SHORTCUTS: 'moment-tab-shortcuts',
        LINK_WINDOW_SETTINGS: 'moment-linkwindow-settings'
    };

    // 🔧 优化：检查Chrome存储API是否可用
    static isChromeStorageAvailable() {
        return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    }

    // 🔧 优化：统一的存储操作接口
    static async _executeStorageOperation(operation, key, data = null) {
        const isChrome = this.isChromeStorageAvailable();
        const storageType = isChrome ? 'Chrome存储' : '本地存储';

        try {
            let result;
            if (operation === 'set') {
                if (isChrome) {
                    await chrome.storage.local.set({ [key]: data });
                } else {
                    localStorage.setItem(key, JSON.stringify(data));
                }
                console.log(`✅ 设置已保存到${storageType} ${key}`);
            } else if (operation === 'get') {
                if (isChrome) {
                    const chromeResult = await chrome.storage.local.get(key);
                    result = chromeResult[key];
                } else {
                    const stored = localStorage.getItem(key);
                    result = stored ? JSON.parse(stored) : null;
                }
            }
            return result;
        } catch (error) {
            console.error(`❌ ${operation === 'set' ? '保存' : '加载'}设置失败 (${key}):`, error);
            throw error;
        }
    }

    /**
     * 保存设置到存储
     * @param {Object} settings - 设置对象
     * @param {string} key - 存储键名，默认为标签管理设置
     * @returns {Promise} 保存结果
     */
    static async saveSettings(settings, key = this.STORAGE_KEYS.TAB_MANAGER_SETTINGS) {
        return this._executeStorageOperation('set', key, settings);
    }

    /**
     * 从存储加载设置
     * @param {string} key - 存储键名，默认为标签管理设置
     * @returns {Promise<Object>} 设置对象
     */
    static async loadSettings(key = this.STORAGE_KEYS.TAB_MANAGER_SETTINGS) {
        try {
            const result = await this._executeStorageOperation('get', key);
            return result || this.getDefaultSettings(key);
        } catch (error) {
            console.error(`❌ 加载设置失败 (${key}):`, error);
            return this.getDefaultSettings(key);
        }
    }

    /**
     * 保存快捷键设置
     * @param {Object} shortcuts - 快捷键对象
     * @returns {Promise} 保存结果
     */
    static async saveShortcuts(shortcuts) {
        return this.saveSettings(shortcuts, this.STORAGE_KEYS.TAB_SHORTCUTS);
    }

    /**
     * 加载快捷键设置
     * @returns {Promise<Object>} 快捷键对象
     */
    static async loadShortcuts() {
        return this.loadSettings(this.STORAGE_KEYS.TAB_SHORTCUTS);
    }

    /**
     * 获取默认设置
     * @param {string} key - 设置类型键名
     * @returns {Object} 默认设置对象
     */
    static getDefaultSettings(key = this.STORAGE_KEYS.TAB_MANAGER_SETTINGS) {
        const defaults = {
            [this.STORAGE_KEYS.TAB_MANAGER_SETTINGS]: {
                enabled: true,
                grouping: {
                    autoCollapse: false,
                    groupByDomain: true
                }
            },
            [this.STORAGE_KEYS.TAB_SHORTCUTS]: {
                group: 'Ctrl+M',
                dedupe: 'Ctrl+Shift+M',
                copy: 'Ctrl+K',
                ungroup: 'Ctrl+Shift+K'
            }
        };

        return defaults[key] || {};
    }

    /**
     * 批量更新设置
     * @param {Object} updates - 要更新的设置对象，键为存储键名
     * @returns {Promise} 更新结果
     */
    static async batchUpdate(updates) {
        const isChrome = this.isChromeStorageAvailable();
        const storageType = isChrome ? 'Chrome存储' : '本地存储';

        try {
            if (isChrome) {
                await chrome.storage.local.set(updates);
            } else {
                // 🔧 优化：使用Promise.all并行处理localStorage操作
                await Promise.all(
                    Object.entries(updates).map(([key, value]) =>
                        Promise.resolve(localStorage.setItem(key, JSON.stringify(value)))
                    )
                );
            }
            console.log(`✅ 批量设置已保存到${storageType}:`, Object.keys(updates));
        } catch (error) {
            console.error('❌ 批量保存设置失败:', error);
            throw error;
        }
    }
}

/**
 * 消息工具类
 */
class MessageUtils {
    /**
     * 发送消息到background script
     * @param {string} action - 操作类型
     * @param {Object} data - 附加数据
     * @returns {Promise} 响应结果
     */
    static async sendToBackground(action, data = {}) {
        try {
            const response = await chrome.runtime.sendMessage({
                action,
                ...data
            });
            return response;
        } catch (error) {
            console.error(`❌ 发送消息失败 (${action}):`, error);
            throw error;
        }
    }

    /**
     * 发送消息到所有content scripts
     * @param {Object} message - 消息对象
     */
    static async sendToAllTabs(message) {
        try {
            const tabs = await chrome.tabs.query({});
            const promises = tabs.map(tab => 
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                    // 忽略无法发送消息的标签页（如chrome://页面）
                })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error('❌ 发送消息到标签页失败:', error);
        }
    }
}

// 导出工具类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DomainUtils, ShortcutUtils, StorageUtils, MessageUtils };
}
