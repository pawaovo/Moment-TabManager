/**
 * 文本拖拽功能统一配置模块
 * 提供所有文本拖拽相关的常量、URL模板和工具方法
 */

// 文本拖拽常量配置
const TEXT_DRAG_CONFIG = {
    // 拖拽阈值配置
    DRAG_THRESHOLD: 20,        // 最小拖拽距离（像素）
    DRAG_TIMEOUT: 1000,        // 拖拽超时时间（毫秒）
    
    // 搜索引擎URL模板
    SEARCH_ENGINES: {
        baidu: 'https://www.baidu.com/s?wd={query}',
        google: 'https://www.google.com/search?q={query}',
        bing: 'https://www.bing.com/search?q={query}'
    },
    
    // 翻译引擎URL模板
    TRANSLATE_ENGINES: {
        baidu: 'https://fanyi.baidu.com/#{sourceLang}/{targetLang}/{query}',
        google: 'https://translate.google.com/?sl=auto&tl={targetLang}&text={query}&op=translate',
        bing: 'https://www.bing.com/translator?from=auto&to={targetLang}&text={query}'
    },
    
    // 语言代码映射
    LANGUAGE_CODES: {
        zh: { baidu: 'zh', google: 'zh-cn', bing: 'zh-Hans' },
        en: { baidu: 'en', google: 'en', bing: 'en' },
        auto: { baidu: 'auto', google: 'auto', bing: 'auto' }
    },
    
    // 引擎显示名称
    ENGINE_NAMES: {
        baidu: '百度',
        google: 'Google',
        bing: 'Bing'
    },
    
    // 语言显示名称
    LANGUAGE_NAMES: {
        'zh': '中文',
        'en': '英文',
        'auto': '自动检测'
    },
    
    // 默认配置
    DEFAULT_CONFIG: {
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
    },

    // 支持的动作类型
    SUPPORTED_ACTIONS: ['search', 'translate', 'none']
};

/**
 * 文本拖拽工具类
 * 提供通用的计算和URL构建方法
 */
class TextDragUtils {
    /**
     * 计算两点之间的距离
     */
    static calculateDistance(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 计算拖拽方向
     */
    static calculateDirection(start, end) {
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        
        // 确定主要方向（水平或垂直）
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            return deltaX > 0 ? 'right' : 'left';
        } else {
            return deltaY > 0 ? 'down' : 'up';
        }
    }
    
    /**
     * 检查点击位置是否在选中文本范围内
     */
    static isClickInSelection(event, selection) {
        if (!selection || selection.rangeCount === 0) return false;
        
        const range = selection.getRangeAt(0);
        const rects = range.getClientRects();
        
        for (let rect of rects) {
            if (event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * 构建搜索URL
     */
    static buildSearchUrl(text, config) {
        const engine = config.searchEngine || 'baidu';
        const template = TEXT_DRAG_CONFIG.SEARCH_ENGINES[engine];
        
        if (!template) {
            throw new Error(`未知的搜索引擎: ${engine}`);
        }
        
        const url = template.replace('{query}', encodeURIComponent(text));
        const engineName = TEXT_DRAG_CONFIG.ENGINE_NAMES[engine] || engine;
        const title = `${engineName}搜索: ${text}`;
        
        return { url, title };
    }
    
    /**
     * 构建翻译URL
     */
    static buildTranslateUrl(text, config) {
        const engine = config.translateEngine || 'baidu';
        const targetLang = config.targetLanguage || 'zh';
        const template = TEXT_DRAG_CONFIG.TRANSLATE_ENGINES[engine];
        
        if (!template) {
            throw new Error(`未知的翻译引擎: ${engine}`);
        }
        
        // 获取目标语言代码
        const targetLangCode = TEXT_DRAG_CONFIG.LANGUAGE_CODES[targetLang]?.[engine] || targetLang;
        
        // 构建URL，处理不同引擎的参数需求
        const url = this.buildTranslateUrlForEngine(template, text, engine, targetLangCode);
        
        const engineName = TEXT_DRAG_CONFIG.ENGINE_NAMES[engine] || engine;
        const langName = this.getLanguageName(targetLang);
        const title = `${engineName}翻译为${langName}: ${text}`;
        
        return { url, title };
    }
    
    /**
     * 为特定引擎构建翻译URL
     */
    static buildTranslateUrlForEngine(template, text, engine, targetLangCode) {
        let url = template.replace('{query}', encodeURIComponent(text));
        
        if (engine === 'baidu') {
            // 百度翻译需要源语言和目标语言
            return url.replace('{sourceLang}', 'auto').replace('{targetLang}', targetLangCode);
        } else {
            // Google和Bing只需要目标语言
            return url.replace('{targetLang}', targetLangCode);
        }
    }
    
    /**
     * 获取语言显示名称
     */
    static getLanguageName(langCode) {
        return TEXT_DRAG_CONFIG.LANGUAGE_NAMES[langCode] || langCode;
    }
    
    /**
     * 验证拖拽条件
     */
    static validateDragConditions(distance, duration) {
        return distance >= TEXT_DRAG_CONFIG.DRAG_THRESHOLD && 
               duration <= TEXT_DRAG_CONFIG.DRAG_TIMEOUT;
    }
    
    /**
     * 获取默认配置
     */
    static getDefaultConfig() {
        return { ...TEXT_DRAG_CONFIG.DEFAULT_CONFIG };
    }

    /**
     * 检查动作是否需要执行（非"无"动作）
     */
    static shouldExecuteAction(action) {
        return action && action !== 'none' && TEXT_DRAG_CONFIG.SUPPORTED_ACTIONS.includes(action);
    }
}

// 导出配置和工具类
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = {
        TEXT_DRAG_CONFIG,
        TextDragUtils
    };
} else {
    // 浏览器环境 - 防止重复声明
    if (typeof window.TEXT_DRAG_CONFIG === 'undefined') {
        window.TEXT_DRAG_CONFIG = TEXT_DRAG_CONFIG;
    }
    if (typeof window.TextDragUtils === 'undefined') {
        window.TextDragUtils = TextDragUtils;
    }
}
