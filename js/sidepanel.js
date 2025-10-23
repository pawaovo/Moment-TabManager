/**
 * Moment-Unified 侧边栏设置页面脚本
 * 支持标签管理和链接弹窗两个功能模块
 */

class UnifiedSidepanel {
    constructor() {
        this.linkWindowSettings = null;
        this.currentTab = 'tab-manager'; // 默认显示标签管理
        this.shortcutListeners = new Map();

        // 快捷键设置相关属性
        this.isListening = false;
        this.currentShortcut = '';
        this.currentEditingShortcutType = null;
        this.shortcutModalEventsBound = false;
        this.keydownHandler = null;

        this.init();
    }

    async init() {
        console.log('🚀 初始化 Unified 侧边栏');

        // 加载设置
        await this.loadAllSettings();

        // 绑定事件
        this.bindEvents();

        // 更新UI
        this.updateUI();

        // 初始化快捷键监听器
        this.registerNewShortcutListeners();

        console.log('✅ Unified 侧边栏初始化完成');
    }

    async loadAllSettings() {
        try {
            // 加载链接弹窗设置
            const linkResponse = await chrome.runtime.sendMessage({ type: 'getSettings' });
            if (linkResponse.success) {
                this.linkWindowSettings = linkResponse.settings || this.getDefaultLinkWindowSettings();
            } else {
                this.linkWindowSettings = this.getDefaultLinkWindowSettings();
            }

            console.log('📋 设置已加载');
        } catch (error) {
            console.error('❌ 加载设置失败:', error);
            this.linkWindowSettings = this.getDefaultLinkWindowSettings();
        }
    }

    getDefaultLinkWindowSettings() {
        return {
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
                    backgroundOpacity: 0.95
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
    }



    bindEvents() {
        // 标签切换事件
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 标签管理事件
        this.bindTabManagerEvents();

        // 链接弹窗事件
        this.bindLinkWindowEvents();

        // 窗口管理事件
        this.bindWindowManagerEvents();

        // 快捷键模态框事件
        this.bindShortcutModalEvents();
    }

    switchTab(tabName) {
        // 更新按钮状态
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        // 更新内容面板
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(tabName);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        this.currentTab = tabName;
        console.log(`🔄 切换到 ${tabName} 面板`);
    }

    bindTabManagerEvents() {
        // 🔧 优化：统一的按钮事件绑定
        const actionButtons = [
            { id: 'groupTabsBtn', action: 'groupTabs' },
            { id: 'ungroupTabsBtn', action: 'ungroupTabs' },
            { id: 'dedupeTabsBtn', action: 'deduplicateTabs' }
        ];

        actionButtons.forEach(({ id, action }) => {
            document.getElementById(id)?.addEventListener('click', () => {
                this.executeTabAction(action);
            });
        });

        // 特殊处理：复制按钮显示模态框
        document.getElementById('copyTabsBtn')?.addEventListener('click', () => {
            this.showCopyModal();
        });

        // 🔧 优化：统一的快捷键编辑按钮绑定
        const shortcutButtons = [
            { id: 'groupShortcutEditBtn', type: 'group' },
            { id: 'dedupeShortcutEditBtn', type: 'dedupe' },
            { id: 'copyShortcutEditBtn', type: 'copy' },
            { id: 'ungroupShortcutEditBtn', type: 'ungroup' }
        ];

        shortcutButtons.forEach(({ id, type }) => {
            document.getElementById(id)?.addEventListener('click', () => {
                this.startShortcutEdit(type);
            });
        });
    }

    bindShortcutActions() {
        // 已废弃，使用模态框模式
    }

    startShortcutEdit(type) {
        this.currentEditingShortcutType = type;
        this.showShortcutModal();
    }

    // 🔧 优化：提取公共的UI更新方法
    updateShortcutDisplay(shortcut) {
        this.currentShortcut = shortcut;
        const displayEl = document.getElementById('shortcutDisplay');
        const confirmEl = document.getElementById('shortcutConfirm');

        if (displayEl) displayEl.textContent = shortcut;
        if (confirmEl) confirmEl.disabled = false;
    }

    // 🔧 优化：提取修饰键映射
    getModifierKeyMapping() {
        return {
            'Control': 'Ctrl',
            'Alt': 'Alt',
            'Shift': 'Shift',
            'Meta': 'Meta'
        };
    }

    handleShortcutInput(e) {
        // 🔧 优化：简化单个修饰键处理
        const modifierMapping = this.getModifierKeyMapping();
        if (modifierMapping[e.key]) {
            // 只有链接预览功能支持单个修饰键
            if (!this.currentEditingShortcutType) {
                this.updateShortcutDisplay(modifierMapping[e.key]);
                return;
            }
            // 标签管理快捷键忽略单个修饰键
            return;
        }

        // 🔧 优化：简化组合快捷键处理
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        if (e.metaKey) keys.push('Meta');

        // 添加主键
        if (e.key.length === 1 && /[A-Za-z0-9]/.test(e.key)) {
            keys.push(e.key.toUpperCase());
        } else {
            const specialKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Space', 'Enter', 'Tab', 'Escape'];
            if (specialKeys.includes(e.key)) {
                keys.push(e.key);
            }
        }

        // 组合快捷键至少需要一个修饰键和一个主键
        if (keys.length >= 2) {
            this.updateShortcutDisplay(keys.join('+'));
        }
    }



    // 验证快捷键格式
    validateShortcut(shortcut) {
        console.log('🔍 验证快捷键格式:', shortcut);

        if (!shortcut || typeof shortcut !== 'string') {
            console.log('❌ 快捷键为空或不是字符串');
            return false;
        }

        const parts = shortcut.split('+').map(part => part.trim());
        console.log('📋 快捷键组成部分:', parts);

        // 检查是否包含修饰键
        const modifiers = ['Ctrl', 'Alt', 'Shift', 'Meta'];
        const hasModifier = parts.some(part => modifiers.includes(part));

        if (!hasModifier) {
            console.log('❌ 缺少修饰键');
            return false;
        }

        // 检查是否有主键
        const mainKey = parts.find(part => !modifiers.includes(part));
        if (!mainKey || mainKey.length === 0) {
            console.log('❌ 缺少主键');
            return false;
        }

        // 检查主键是否有效
        const validKeys = /^[A-Za-z0-9]$|^(F[1-9]|F1[0-2])$|^(Space|Enter|Tab|Escape|Delete|Backspace)$/;
        if (!validKeys.test(mainKey)) {
            console.log('❌ 主键无效:', mainKey);
            return false;
        }

        console.log('✅ 快捷键格式有效');
        return true;
    }

    // 格式化快捷键显示
    formatShortcut(shortcut) {
        if (!shortcut) return '';

        // 标准化快捷键格式
        return shortcut
            .split('+')
            .map(part => part.trim())
            .filter(part => part.length > 0)
            .join('+');
    }



    // 🔧 新增：获取默认快捷键配置
    getDefaultShortcuts() {
        return {
            group: 'Ctrl+M',
            dedupe: 'Ctrl+Shift+M',
            copy: 'Ctrl+K',
            ungroup: 'Ctrl+Shift+K'
        };
    }

    // 🔧 新增：快捷键类型到按钮ID的映射
    getShortcutTypeMapping() {
        return {
            group: 'groupTabs',
            dedupe: 'dedupeTabs',
            copy: 'copyTabs',
            ungroup: 'ungroupTabs'
        };
    }

    // 🔧 优化：简化快捷键显示更新逻辑
    async updateShortcutDisplays() {
        let shortcuts;

        try {
            // 检查 StorageUtils 可用性并加载快捷键
            if (typeof StorageUtils !== 'undefined') {
                shortcuts = await StorageUtils.loadShortcuts();
            } else {
                console.warn('StorageUtils 未定义，使用默认快捷键');
                shortcuts = this.getDefaultShortcuts();
            }
        } catch (error) {
            console.error('更新快捷键显示失败:', error);
            shortcuts = this.getDefaultShortcuts();
        }

        this.updateShortcutUI(shortcuts);
    }

    // 🔧 优化：提取UI更新逻辑，减少DOM查询
    updateShortcutUI(shortcuts) {
        const typeMapping = this.getShortcutTypeMapping();

        // 🔧 优化：批量获取DOM元素，减少重复查询
        const elements = {};
        Object.keys(shortcuts).forEach(type => {
            elements[type] = {
                text: document.getElementById(`${type}ShortcutText`),
                button: document.querySelector(`#${typeMapping[type]}Btn .btn-shortcut`)
            };
        });

        // 🔧 优化：批量更新UI
        Object.entries(shortcuts).forEach(([type, shortcut]) => {
            const formattedShortcut = this.formatShortcut(shortcut);
            const { text, button } = elements[type];

            if (text) text.textContent = formattedShortcut;
            if (button) button.textContent = formattedShortcut;
        });
    }

    showCopyModal() {
        // 创建复制选项模态框
        const modal = document.createElement('div');
        modal.className = 'copy-modal-overlay';
        modal.innerHTML = `
            <div class="copy-modal">
                <h4>复制标签页</h4>
                <button class="copy-option-btn" data-action="copyCurrentTab">
                    <span class="btn-icon">📄</span>
                    复制当前页面
                </button>
                <button class="copy-option-btn" data-action="copyAllTabs">
                    <span class="btn-icon">📋</span>
                    复制所有页面
                </button>
                <button class="copy-cancel-btn">取消</button>
            </div>
        `;

        // 绑定事件
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-modal-overlay') || e.target.classList.contains('copy-cancel-btn')) {
                modal.remove();
            } else if (e.target.closest('.copy-option-btn')) {
                const action = e.target.closest('.copy-option-btn').dataset.action;
                this.executeTabAction(action);
                modal.remove();
            }
        });

        document.body.appendChild(modal);
    }
    bindWindowManagerEvents() {
        // 打开窗口管理器按钮
        document.getElementById('openWindowManagerBtn')?.addEventListener('click', () => {
            this.openWindowManager();
        });

        // 注意：布局配置和标签页列表功能已移至独立的窗口管理页面
        // 这里只保留打开窗口管理器的功能
    }

    async openWindowManager() {
        try {
            // 创建窗口管理页面
            const tab = await chrome.tabs.create({
                url: chrome.runtime.getURL('window-manager.html')
            });

            console.log('🪟 窗口管理页面已打开:', tab.id);
            this.showStatusMessage('窗口管理页面已打开', 'success');
        } catch (error) {
            console.error('❌ 打开窗口管理页面失败:', error);
            this.showStatusMessage('打开窗口管理页面失败: ' + error.message, 'error');
        }
    }
    // 配置管理功能已移至 window-manager.js，避免代码重复
    // 标签页管理功能已移至 window-manager.js，避免代码重复





    updateUI() {
        // 根据当前标签更新UI
        if (this.currentTab === 'tab-manager') {
            this.updateTabManagerUI();
        } else if (this.currentTab === 'link-preview') {
            this.updateLinkWindowUI();
        } else if (this.currentTab === 'window-manager') {
            this.updateWindowManagerUI();
        }
    }

    updateTabManagerUI() {
        // 更新快捷键显示
        this.updateShortcutDisplays();
    }

    updateLinkWindowUI() {
        // 更新链接弹窗相关UI
        this.updateLinkWindowSettings();
    }

    async updateWindowManagerUI() {
        // 窗口管理功能已移至独立页面，侧边栏只显示基本信息
        console.log('✅ 窗口管理面板已显示');
    }

    updateLinkWindowSettings() {
        if (!this.linkWindowSettings) return;

        // 更新触发方式
        const triggerMethod = document.getElementById('triggerMethod');
        if (triggerMethod && this.linkWindowSettings.linkPreview?.trigger?.method) {
            triggerMethod.value = this.linkWindowSettings.linkPreview.trigger.method;
        }

        // 更新其他设置...
        // 这里可以添加更多LinkWindow设置的UI更新逻辑
    }

    bindLinkWindowEvents() {
        // 触发方式变化
        document.getElementById('triggerMethod')?.addEventListener('change', (e) => {
            this.updateTriggerMethod(e.target.value);
        });

        // 自定义快捷键设置
        document.getElementById('customKeyBtn')?.addEventListener('click', () => {
            this.showShortcutModal('linkWindow');
        });

        // 滑块事件
        document.getElementById('triggerDelay')?.addEventListener('input', async (e) => {
            await this.updateSliderValue(e.target, 'ms');
        });

        document.getElementById('backgroundOpacity')?.addEventListener('input', async (e) => {
            await this.updateSliderValue(e.target, '%', 100);
        });

        // 颜色选择器
        document.getElementById('windowColor')?.addEventListener('change', async (e) => {
            await this.updateLinkWindowSetting('linkPreview.window.color', e.target.value);
        });

        // 颜色预设
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', async () => {
                const color = preset.dataset.color;
                document.getElementById('windowColor').value = color;
                await this.updateSetting('linkPreview.window.color', color);
            });
        });

        // 其他选择器
        this.bindSelectEvents();

        // 操作按钮
        const resetBtn = document.getElementById('resetSettings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetSettings();
            });
        }

        // 快捷键模态框事件已在 bindEvents 中统一绑定
    }

    bindSelectEvents() {
        const selectMappings = {
            'windowSize': 'linkPreview.window.size',
            'windowPosition': 'linkPreview.window.position',
            'windowBackground': 'linkPreview.window.background',
            'textDragEnabled': 'linkPreview.textActions.enabled',
            'dragUp': 'linkPreview.textActions.directions.up',
            'dragDown': 'linkPreview.textActions.directions.down',
            'dragLeft': 'linkPreview.textActions.directions.left',
            'dragRight': 'linkPreview.textActions.directions.right',
            'searchEngine': 'linkPreview.textActions.searchEngine',
            'translateEngine': 'linkPreview.textActions.translateEngine',
            'targetLanguage': 'linkPreview.textActions.targetLanguage'
        };

        Object.entries(selectMappings).forEach(([elementId, settingPath]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener('change', async (e) => {
                    let value = e.target.value;
                    if (settingPath === 'linkPreview.textActions.enabled') {
                        value = value === 'true';
                    }
                    await this.updateSetting(settingPath, value);
                });
            }
        });
    }

    bindShortcutModalEvents() {
        // 防止重复绑定
        if (this.shortcutModalEventsBound) {
            return;
        }

        const cancelBtn = document.getElementById('shortcutCancel');
        const confirmBtn = document.getElementById('shortcutConfirm');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideShortcutModal();
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmShortcut();
            });
        }

        // 监听键盘事件
        this.keydownHandler = (e) => {
            if (this.isListening) {
                e.preventDefault();
                e.stopPropagation();
                this.handleShortcutInput(e);
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
        this.shortcutModalEventsBound = true;
    }

    async updateTriggerMethod(method) {
        this.updateSetting('linkPreview.trigger.method', method);

        // 更新UI显示
        const customKeyContainer = document.getElementById('customKeyContainer');
        const triggerDelayContainer = document.getElementById('triggerDelayContainer');

        const needsCustomKey = method.includes('alt+') || method.includes('自定义快捷键');
        const needsDelay = ['alt+hover', 'longpress', 'hover'].includes(method);

        customKeyContainer.style.display = needsCustomKey ? 'block' : 'none';

        const delaySlider = document.getElementById('triggerDelay');
        const delayDescription = triggerDelayContainer.querySelector('.delay-description');

        if (needsDelay) {
            delaySlider.disabled = false;
            delayDescription.textContent = this.getDelayDescription(method);
            triggerDelayContainer.classList.remove('disabled');
        } else {
            delaySlider.disabled = true;
            delayDescription.textContent = '当前触发方式不支持延迟设置';
            triggerDelayContainer.classList.add('disabled');
        }

        // 自动保存设置
        await this.saveSettings();
        console.log(`🔧 触发方式已更新: ${method}`);
    }

    getDelayDescription(method) {
        const descriptions = {
            'alt+hover': '调节悬停触发的延迟时间',
            'longpress': '调节长按触发的延迟时间',
            'hover': '调节悬停触发的延迟时间'
        };
        return descriptions[method] || '调节触发延迟时间';
    }

    async updateSliderValue(slider, unit, multiplier = 1) {
        const value = parseFloat(slider.value);
        const displayValue = Math.round(value * multiplier);
        const valueSpan = slider.parentNode.querySelector('.slider-value');
        valueSpan.textContent = `${displayValue}${unit}`;

        // 更新设置
        const settingPath = slider.id === 'triggerDelay' ?
            'linkPreview.trigger.delay' : 'linkPreview.window.backgroundOpacity';
        await this.updateSetting(settingPath, value);
    }

    async updateSetting(path, value) {
        const keys = path.split('.');
        let current = this.linkWindowSettings;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        console.log(`🔧 设置已更新并保存: ${path} = ${value}`);

        // 自动保存设置
        await this.saveSettings();
    }

    updateUI() {
        if (!this.linkWindowSettings) return;

        const { linkPreview } = this.linkWindowSettings;

        // 更新基础设置
        this.setSelectValue('triggerMethod', linkPreview.trigger.method);
        this.updateTriggerMethod(linkPreview.trigger.method);

        document.getElementById('customKey').value = linkPreview.trigger.customKey || 'Alt';

        const delaySlider = document.getElementById('triggerDelay');
        delaySlider.value = linkPreview.trigger.delay || 300;
        this.updateSliderValue(delaySlider, 'ms');

        this.setSelectValue('windowSize', linkPreview.window.size);
        this.setSelectValue('windowPosition', linkPreview.window.position);

        document.getElementById('windowColor').value = linkPreview.window.color || '#667eea';

        const opacitySlider = document.getElementById('backgroundOpacity');
        opacitySlider.value = linkPreview.window.backgroundOpacity || 0.95;
        this.updateSliderValue(opacitySlider, '%', 100);

        this.setSelectValue('windowBackground', linkPreview.window.background);

        // 更新文本拖拽设置
        this.setSelectValue('textDragEnabled', linkPreview.textActions.enabled ? 'true' : 'false');
        this.setSelectValue('dragUp', linkPreview.textActions.directions.up);
        this.setSelectValue('dragDown', linkPreview.textActions.directions.down);
        this.setSelectValue('dragLeft', linkPreview.textActions.directions.left);
        this.setSelectValue('dragRight', linkPreview.textActions.directions.right);
        this.setSelectValue('searchEngine', linkPreview.textActions.searchEngine);
        this.setSelectValue('translateEngine', linkPreview.textActions.translateEngine);
        this.setSelectValue('targetLanguage', linkPreview.textActions.targetLanguage);
    }

    setSelectValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && value !== undefined) {
            element.value = value;
        }
    }

    showShortcutModal() {
        const modal = document.getElementById('shortcutModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        this.isListening = true;
        this.currentShortcut = '';

        const displayEl = document.getElementById('shortcutDisplay');
        const confirmEl = document.getElementById('shortcutConfirm');

        if (displayEl) {
            displayEl.textContent = '等待输入...';
        }

        if (confirmEl) {
            confirmEl.disabled = true;
        }
    }

    hideShortcutModal() {
        const modal = document.getElementById('shortcutModal');
        modal.classList.add('hidden');
        this.isListening = false;
        this.currentShortcut = '';
    }

    // 移除旧的快捷键监听器
    removeOldShortcutListeners() {
        this.shortcutListeners.forEach((listener, key) => {
            document.removeEventListener('keydown', listener);
            console.log(`🗑️ 已移除快捷键监听器: ${key}`);
        });
        this.shortcutListeners.clear();
    }



    // 注册新的快捷键监听器
    registerNewShortcutListeners() {
        // 注册链接弹窗快捷键
        this.registerLinkPreviewShortcuts();


    }

    // 注册链接弹窗快捷键
    registerLinkPreviewShortcuts() {
        if (!this.linkWindowSettings || !this.linkWindowSettings.linkPreview) {
            console.warn('链接弹窗设置未加载，跳过快捷键注册');
            return;
        }

        const triggerMethod = this.linkWindowSettings.linkPreview.trigger.method;
        const customKey = this.linkWindowSettings.linkPreview.trigger.customKey;

        // 只有在使用自定义快捷键的触发方式时才注册监听器
        if (triggerMethod.includes('alt+') || triggerMethod.includes('自定义快捷键')) {
            const listenerKey = `linkPreview_${triggerMethod}_${customKey}`;

            const listener = (e) => {
                // 检查是否按下了正确的修饰键
                const isCorrectKey = this.isCustomKeyPressed(e, customKey);
                if (isCorrectKey) {
                    console.log(`⌨️ 检测到链接弹窗快捷键: ${customKey}`);
                    // 这里可以添加快捷键触发的逻辑
                }
            };

            document.addEventListener('keydown', listener);
            this.shortcutListeners.set(listenerKey, listener);
        }
    }





    // 检查是否按下了指定的修饰键
    isCustomKeyPressed(event, customKey) {
        switch (customKey) {
            case 'Alt':
                return event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey;
            case 'Ctrl':
                return event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
            case 'Shift':
                return event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
            case 'Meta':
                return event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
            default:
                return event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey;
        }
    }

    // 错误的 handleShortcutInput 方法已删除，使用正确的实现

    async confirmShortcut() {
        if (this.currentShortcut) {
            // 检查是否是标签管理快捷键设置
            if (this.currentEditingShortcutType) {
                // 标签管理快捷键设置
                await this.saveTabManagerShortcut(this.currentEditingShortcutType, this.currentShortcut);
                this.currentEditingShortcutType = null;
            } else {
                // 链接弹窗快捷键设置
                this.removeOldShortcutListeners();
                this.updateSetting('linkPreview.trigger.customKey', this.currentShortcut);
                document.getElementById('customKey').value = this.currentShortcut;
                await this.saveSettings();
                this.registerNewShortcutListeners();

                // 🔧 修复：通知所有content script更新快捷键设置
                await this.notifyContentScriptsShortcutUpdate();

                this.showStatusMessage('快捷键已更新为: ' + this.currentShortcut, 'success');
            }
        }
        this.hideShortcutModal();
    }

    // 🔧 修复：添加缺失的获取操作名称映射方法
    getActionNames() {
        return {
            group: '分组',
            dedupe: '去重',
            copy: '复制',
            ungroup: '取消分组'
        };
    }

    // 🔧 优化：检查Chrome扩展环境是否可用
    _isChromeExtensionAvailable() {
        return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage;
    }

    // 🔧 优化：统一的成功消息处理
    _showShortcutSaveSuccess(type, shortcut) {
        const actionNames = this.getActionNames();
        const actionName = actionNames[type] || '未知操作';
        this.showStatusMessage(`${actionName}快捷键已更新为 ${shortcut}`, 'success');
    }

    // 🔧 优化：简化的快捷键保存主方法
    async saveTabManagerShortcut(type, shortcut) {
        try {
            if (this._isChromeExtensionAvailable()) {
                await this._saveViaExtension(type, shortcut);
            } else {
                await this._saveDirectly(type, shortcut);
            }
        } catch (error) {
            console.error('保存快捷键失败:', error);
            // 🔧 优化：扩展API失败时的备用机制
            if (this._isChromeExtensionAvailable()) {
                try {
                    await this._saveDirectly(type, shortcut);
                } catch (fallbackError) {
                    this.showStatusMessage('保存快捷键失败：' + fallbackError.message, 'error');
                }
            } else {
                this.showStatusMessage('保存快捷键失败：' + error.message, 'error');
            }
        }
    }

    // 🔧 优化：通过扩展API保存快捷键
    async _saveViaExtension(type, shortcut) {
        const response = await chrome.runtime.sendMessage({
            action: 'updateShortcuts',
            shortcuts: { [type]: shortcut }
        });

        if (response?.success) {
            await this.updateShortcutDisplays();
            this._showShortcutSaveSuccess(type, shortcut);
        } else {
            throw new Error(response?.error || '未知错误');
        }
    }

    // 🔧 优化：直接保存快捷键的方法
    async _saveDirectly(type, shortcut) {
        // 加载当前快捷键设置
        const currentShortcuts = await StorageUtils.loadShortcuts();

        // 更新指定类型的快捷键
        const updatedShortcuts = { ...currentShortcuts, [type]: shortcut };

        // 保存更新后的快捷键
        await StorageUtils.saveShortcuts(updatedShortcuts);

        // 更新显示
        await this.updateShortcutDisplays();

        this._showShortcutSaveSuccess(type, shortcut);
        console.log('✅ 快捷键已直接保存:', { [type]: shortcut });
    }

    // 🔧 优化：通知所有content script更新快捷键设置
    async notifyContentScriptsShortcutUpdate() {
        try {
            const tabs = await chrome.tabs.query({});
            const updatePromises = tabs.map(async (tab) => {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'updateShortcutSettings',
                        settings: this.linkWindowSettings
                    });
                } catch (error) {
                    // 忽略无法发送消息的标签页（如chrome://页面）
                }
            });

            await Promise.allSettled(updatePromises);
        } catch (error) {
            console.error('通知content script更新快捷键失败:', error);
        }
    }

    async resetSettings() {
        if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
            this.linkWindowSettings = this.getDefaultLinkWindowSettings();
            this.updateUI();
            await this.saveSettings();
            this.showStatusMessage('设置已重置', 'success');
        }
    }

    async saveSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'updateSettings',
                settings: this.linkWindowSettings
            });

            if (response.success) {
                return true;
            } else {
                console.error('❌ 设置保存失败:', response.error);
                this.showStatusMessage('保存失败: ' + response.error, 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            this.showStatusMessage('保存失败: ' + error.message, 'error');
            return false;
        }
    }

    showStatusMessage(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type}`;
        statusEl.classList.remove('hidden');

        setTimeout(() => {
            statusEl.classList.add('hidden');
        }, 3000);
    }
    // ===== 标签管理相关方法 =====

    // 🔧 新增：格式化成功消息的方法
    formatSuccessMessage(action, result) {
        const actionName = this.getActionName(action);

        if (!result) return `${actionName}成功`;

        // 🔧 优化：使用映射表简化消息格式化
        const messageFormatters = {
            groupCount: (count) => `成功创建了 ${count} 个分组`,
            ungroupCount: (count) => `成功取消了 ${count} 个分组`,
            count: (count) => `成功复制了 ${count} 个标签页`,
            closedCount: (count) => `成功关闭了 ${count} 个重复标签页`,
            title: (title) => `成功复制: ${title}`,
            message: (msg) => msg
        };

        for (const [key, formatter] of Object.entries(messageFormatters)) {
            if (result[key] !== undefined) {
                return formatter(result[key]);
            }
        }

        return `${actionName}成功`;
    }

    async executeTabAction(action) {
        console.log(`🔥 执行标签操作: ${action}`);

        try {
            const response = await chrome.runtime.sendMessage({ action });
            console.log(`📥 收到响应:`, response);

            if (response?.success) {
                const message = this.formatSuccessMessage(action, response.result);
                console.log(`✅ 操作成功: ${message}`);
                this.showStatusMessage(message, 'success');
            } else {
                const errorMessage = `${this.getActionName(action)}失败: ${response?.error || '未知错误'}`;
                console.error(`❌ 操作失败: ${errorMessage}`);
                this.showStatusMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error(`❌ 执行${action}失败:`, error);
            this.showStatusMessage(`${this.getActionName(action)}失败: ${error.message}`, 'error');
        }
    }

    getActionName(action) {
        const actionNames = {
            'groupTabs': '标签分组',
            'ungroupTabs': '取消分组',
            'deduplicateTabs': '标签去重',
            'copyCurrentTab': '复制当前页面',
            'copyAllTabs': '复制所有页面'
        };
        return actionNames[action] || action;
    }



    // ===== 链接弹窗相关方法 =====

    async updateLinkWindowSetting(path, value) {
        try {
            const keys = path.split('.');
            let current = this.linkWindowSettings;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }

            current[keys[keys.length - 1]] = value;
            console.log(`🔧 LinkWindow设置已更新: ${path} = ${value}`);

            // 保存设置
            await this.saveLinkWindowSettings();
        } catch (error) {
            console.error('❌ 更新LinkWindow设置失败:', error);
        }
    }

    async saveLinkWindowSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'updateSettings',
                settings: this.linkWindowSettings
            });

            if (response.success) {
                console.log('✅ LinkWindow设置已保存');
                return true;
            } else {
                console.error('❌ LinkWindow设置保存失败:', response.error);
                this.showStatusMessage('保存失败: ' + response.error, 'error');
                return false;
            }
        } catch (error) {
            console.error('❌ 保存LinkWindow设置失败:', error);
            this.showStatusMessage('保存失败', 'error');
            return false;
        }
    }

    // ===== 通用方法 =====

    updateSliderDisplay(slider) {
        const valueSpan = slider.parentElement.querySelector('.slider-value');
        if (valueSpan) {
            valueSpan.textContent = slider.value;
        }
    }

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
    }
}

// 初始化侧边栏
document.addEventListener('DOMContentLoaded', () => {
    new UnifiedSidepanel();
});
