/**
 * 全局快捷键处理器
 * 在所有网页中监听用户自定义的快捷键
 */

(function() {
    'use strict';

    // 避免重复注入
    if (window.momentTabManagerInjected) {
        return;
    }
    window.momentTabManagerInjected = true;



    // 用户快捷键设置
    let userShortcuts = {
        group: 'Ctrl+M',
        dedupe: 'Ctrl+Shift+M',
        copy: 'Ctrl+K',
        ungroup: 'Ctrl+Shift+K'
    };

    /**
     * 从本地存储获取用户快捷键设置
     */
    async function loadUserShortcuts() {
        try {
            // 直接从本地存储获取设置
            const result = await chrome.storage.local.get(['moment-tab-shortcuts']);
            if (result['moment-tab-shortcuts']) {
                userShortcuts = { ...userShortcuts, ...result['moment-tab-shortcuts'] };
            }
        } catch (error) {
            console.warn('获取用户快捷键设置失败:', error);
        }
    }

    /**
     * 监听存储变化，自动更新快捷键设置
     */
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes['moment-tab-shortcuts']) {
            const newShortcuts = changes['moment-tab-shortcuts'].newValue;
            if (newShortcuts) {
                userShortcuts = { ...userShortcuts, ...newShortcuts };
            }
        }
    });

    /**
     * 监听来自background script的快捷键更新消息
     */
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'shortcutsUpdated' && message.shortcuts) {
            userShortcuts = { ...userShortcuts, ...message.shortcuts };
        }
    });

    /**
     * 解析快捷键字符串
     */
    function parseShortcut(shortcutStr) {
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
     */
    function isShortcutMatch(event, shortcutStr) {
        const shortcut = parseShortcut(shortcutStr);
        
        return event.ctrlKey === shortcut.ctrl &&
               event.shiftKey === shortcut.shift &&
               event.altKey === shortcut.alt &&
               event.metaKey === shortcut.meta &&
               event.key.toUpperCase() === shortcut.key;
    }

    /**
     * 静默获取页面焦点
     */
    function ensurePageFocus() {
        if (document.hasFocus && document.hasFocus()) return;

        try {
            const focusElement = document.createElement('div');
            focusElement.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none';
            focusElement.tabIndex = -1;
            document.body.appendChild(focusElement);
            focusElement.focus();
            document.body.removeChild(focusElement);
        } catch (e) {
            // 静默处理错误
        }
    }

    /**
     * 键盘事件处理器
     */
    function handleKeyDown(event) {
        // 忽略在输入框中的按键
        const activeElement = document.activeElement;
        if (activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        )) {
            return;
        }

        // 确保页面有焦点后再处理快捷键
        ensurePageFocus();

        // 快捷键映射表
        const shortcutActions = {
            [userShortcuts.group]: () => chrome.runtime.sendMessage({ action: 'groupTabs' }),
            [userShortcuts.dedupe]: () => chrome.runtime.sendMessage({ action: 'deduplicateTabs' }),
            [userShortcuts.copy]: () => showCopyTabsModal(),
            [userShortcuts.ungroup]: () => chrome.runtime.sendMessage({ action: 'ungroupTabs' })
        };

        // 检查并执行匹配的快捷键
        for (const [shortcut, action] of Object.entries(shortcutActions)) {
            if (isShortcutMatch(event, shortcut)) {
                event.preventDefault();
                event.stopPropagation();
                action();
                break;
            }
        }
    }

    /**
     * 显示复制标签弹窗
     */
    function showCopyTabsModal() {
        // 检查是否已存在弹窗
        if (document.getElementById('momentCopyTabsModal')) {
            return;
        }

        // 创建弹窗遮罩
        const overlay = document.createElement('div');
        overlay.id = 'momentCopyTabsModal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.3);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 100px;
        `;

        // 创建弹窗内容
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            padding: 20px;
            display: flex;
            gap: 12px;
            animation: momentModalSlideIn 0.2s ease-out;
        `;

        // 创建按钮
        const copyCurrentBtn = createModalButton('复制当前页面', () => {
            chrome.runtime.sendMessage({ action: 'copyCurrentTab' });
            closeCopyTabsModal();
        });

        const copyAllBtn = createModalButton('复制所有页面', () => {
            chrome.runtime.sendMessage({ action: 'copyAllTabs' });
            closeCopyTabsModal();
        });

        // 点击遮罩关闭弹窗
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeCopyTabsModal();
            }
        });

        // 组装弹窗
        modal.appendChild(copyCurrentBtn);
        modal.appendChild(copyAllBtn);
        overlay.appendChild(modal);

        // 添加CSS动画（只添加一次）
        ensureModalStyles();

        // 显示弹窗
        document.body.appendChild(overlay);
    }

    /**
     * 创建弹窗按钮
     */
    function createModalButton(text, clickHandler) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            background: #007bff;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;

        // 添加悬停效果
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#0056b3';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#007bff';
        });

        button.addEventListener('click', clickHandler);
        return button;
    }

    /**
     * 关闭复制标签弹窗
     */
    function closeCopyTabsModal() {
        const modal = document.getElementById('momentCopyTabsModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * 确保弹窗样式只添加一次
     */
    function ensureModalStyles() {
        if (!document.getElementById('momentModalStyles')) {
            const style = document.createElement('style');
            style.id = 'momentModalStyles';
            style.textContent = `
                @keyframes momentModalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }



    // 初始化
    loadUserShortcuts().then(() => {
        // 添加全局键盘监听器
        document.addEventListener('keydown', handleKeyDown, true);
    });

})();
