/**
 * AMMF WebUI 国际化模块
 * 提供多语言支持功能
 */

const I18n = {
    currentLang: 'zh',
    supportedLangs: ['zh', 'en', 'ru'],
    translations: {
        zh: {},
        en: {},
        ru: {}
    },
    // 模块扩展翻译
    moduleTranslations: {
        zh: {},
        en: {},
        ru: {}
    },


    async init() {
        try {
            console.log('开始初始化语言模块...');
            
            // 并行加载翻译文件
            await Promise.all([
                this.loadTranslations(),
                this.loadModuleTranslations()
            ]);
            
            await this.determineInitialLanguage();
            this.applyTranslations();
            this.observeDOMChanges();
            
            console.log(`语言模块初始化完成: ${this.currentLang}`);
            
            // 分发初始化完成事件
            document.dispatchEvent(new CustomEvent('i18nReady', {
                detail: { language: this.currentLang }
            }));
            
            return true;
        } catch (error) {
            console.error('初始化语言模块失败:', error);
            this.currentLang = 'zh';
            return false;
        }
    },



    async loadTranslations() {
        try {
            // 加载每种语言的翻译文件
            const loadPromises = this.supportedLangs.map(async lang => {
                try {
                    const response = await fetch(`translations/${lang}.json`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const translations = await response.json();
                    // 验证加载的翻译数据
                    if (typeof translations === 'object' && Object.keys(translations).length > 0) {
                        this.translations[lang] = translations;
                        console.log(`成功加载${lang}语言文件，包含 ${Object.keys(translations).length} 个翻译项`);
                    } else {
                        throw new Error(`${lang}语言文件格式无效`);
                    }
                } catch (error) {
                    console.error(`加载${lang}语言文件失败:`, error);
                    // 如果是中文翻译加载失败，使用基础翻译
                    if (lang === 'zh') {
                        this.translations.zh = this.getBaseTranslations();
                    }
                }
            });

            await Promise.all(loadPromises);

            // 验证所有语言是否都有基本的翻译内容
            this.supportedLangs.forEach(lang => {
                if (!this.translations[lang] || Object.keys(this.translations[lang]).length === 0) {
                    console.warn(`${lang}语言翻译内容为空，使用基础翻译`);
                    this.translations[lang] = this.getBaseTranslations();
                }
            });
        } catch (error) {
            console.error('加载翻译文件失败:', error);
            // 确保至少有基础的中文翻译
            this.translations.zh = this.getBaseTranslations();
        }
    },

    // 新增：加载模块扩展翻译
    async loadModuleTranslations() {
        try {
            console.log('开始加载模块扩展翻译...');
            // 加载每种语言的模块翻译文件
            const loadPromises = this.supportedLangs.map(async lang => {
                try {
                    const response = await fetch(`translations/module/${lang}.json`);
                    // 如果文件不存在，静默失败
                    if (response.status === 404) {
                        console.log(`模块翻译文件不存在: translations/module/${lang}.json`);
                        return;
                    }
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const moduleTranslations = await response.json();
                    
                    // 验证加载的翻译数据
                    if (typeof moduleTranslations === 'object' && Object.keys(moduleTranslations).length > 0) {
                        // 存储模块翻译
                        this.moduleTranslations[lang] = moduleTranslations;
                        
                        // 将模块翻译合并到主翻译中（模块翻译优先级低于主翻译）
                        this.translations[lang] = {
                            ...moduleTranslations,
                            ...this.translations[lang]  // 主翻译覆盖同名的模块翻译
                        };
                        
                        console.log(`成功加载${lang}模块翻译文件，包含 ${Object.keys(moduleTranslations).length} 个翻译项`);
                    } else {
                        console.warn(`${lang}模块翻译文件格式无效或为空`);
                    }
                } catch (error) {
                    // 模块翻译加载失败不影响主程序运行
                    console.warn(`加载${lang}模块翻译文件失败:`, error.message);
                }
            });

            await Promise.all(loadPromises);
            console.log('模块扩展翻译加载完成');
        } catch (error) {
            console.warn('加载模块翻译文件失败:', error.message);
        }
    },

    async determineInitialLanguage() {
        try {
            const savedLang = localStorage.getItem('currentLanguage');
            if (savedLang && this.supportedLangs.includes(savedLang)) {
                this.currentLang = savedLang;
                return;
            }
            const browserLang = navigator.language.split('-')[0];
            if (this.supportedLangs.includes(browserLang)) {
                this.currentLang = browserLang;
                localStorage.setItem('currentLanguage', this.currentLang);
                return;
            }
            console.log(`使用默认语言: ${this.currentLang}`);
        } catch (error) {
            console.error('确定初始语言失败:', error);
        }
    },

    applyTranslations() {
        // 更新页面标题
        const pageTitle = this.translate('PAGE_TITLE');
        if (pageTitle && pageTitle !== 'PAGE_TITLE') {
            document.title = pageTitle;
        }

        // 处理带有 data-i18n 属性的元素
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.translate(key);
            if (translation && translation !== key) {
                el.textContent = translation;
            }
        });

        // 处理带有 data-i18n-placeholder 属性的元素
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.translate(key);
            if (translation && translation !== key) {
                el.setAttribute('placeholder', translation);
            }
        });

        // 处理带有 data-i18n-title 属性的元素
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.translate(key);
            if (translation && translation !== key) {
                el.setAttribute('title', translation);
            }
        });

        // 处理带有 data-i18n-label 属性的元素
        const labelElements = document.querySelectorAll('[data-i18n-label]');
        labelElements.forEach(el => {
            const key = el.getAttribute('data-i18n-label');
            const translation = this.translate(key);
            if (translation && translation !== key && el.querySelector('.switch-label')) {
                el.querySelector('.switch-label').textContent = translation;
            }
        });
        
        // 处理带有 data-i18n-aria-label 属性的元素
        const ariaLabelElements = document.querySelectorAll('[data-i18n-aria-label]');
        ariaLabelElements.forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            const translation = this.translate(key);
            if (translation && translation !== key) {
                el.setAttribute('aria-label', translation);
            }
        });
        
        // 处理带有 data-i18n-value 属性的元素（如按钮值）
        const valueElements = document.querySelectorAll('[data-i18n-value]');
        valueElements.forEach(el => {
            const key = el.getAttribute('data-i18n-value');
            const translation = this.translate(key);
            if (translation && translation !== key) {
                el.setAttribute('value', translation);
            }
        });
        
        console.log(`已应用翻译到 ${elements.length + placeholderElements.length + titleElements.length + labelElements.length + ariaLabelElements.length + valueElements.length} 个元素`);
    },

    translate(key, defaultText = '') {
        if (!key) return defaultText;

        // 支持参数替换，例如：translate('HELLO', '你好 {name}', {name: '张三'})
        if (arguments.length > 2 && typeof arguments[2] === 'object') {
            let text = this.translations[this.currentLang][key] || defaultText || key;
            const params = arguments[2];

            for (const param in params) {
                if (Object.prototype.hasOwnProperty.call(params, param)) {
                    text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
                }
            }

            return text;
        }

        return this.translations[this.currentLang][key] || defaultText || key;
    },


    // 优化后的语言切换方法
    async setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) {
            console.warn(`不支持的语言: ${lang}`);
            return false;
        }

        if (lang === this.currentLang) {
            return true;
        }

        try {
            const oldLang = this.currentLang;
            this.currentLang = lang;
            localStorage.setItem('selectedLanguage', lang);
            
            // 清理渲染缓存以确保新语言立即生效
            if (window.app && typeof window.app.clearRenderCache === 'function') {
                window.app.clearRenderCache();
            }
            
            // 应用翻译到静态元素
            this.applyTranslations();
            
            // 通知其他组件语言已更改
            this.notifyLanguageChange(lang, oldLang);
            
            console.log(`语言已切换到: ${lang}`);
            return true;
        } catch (error) {
            console.error('切换语言失败:', error);
            return false;
        }
    },

    // 通知语言变化
    notifyLanguageChange(lang, oldLang = null) {
        // 分发自定义事件，让其他模块处理UI更新
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { 
                language: lang,
                oldLanguage: oldLang,
                timestamp: Date.now()
            }
        }));
    },



    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 优化后的DOM变化观察方法
    observeDOMChanges() {
        if (this.observer) {
            this.observer.disconnect();
        }

        // 使用防抖函数优化性能
        const debouncedApplyTranslations = this.debounce(() => {
            this.applyTranslations();
        }, 300);

        this.observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // 检查新增的节点是否包含需要翻译的元素
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.hasAttribute && (
                                node.hasAttribute('data-i18n') ||
                                node.hasAttribute('data-i18n-placeholder') ||
                                node.hasAttribute('data-i18n-title') ||
                                node.hasAttribute('data-i18n-label') ||
                                node.querySelector && node.querySelector('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-label]')
                            )) {
                                shouldUpdate = true;
                            }
                        }
                    });
                } else if (mutation.type === 'attributes') {
                    // 检查属性变化是否涉及翻译相关属性
                    const attrName = mutation.attributeName;
                    if (attrName && (
                        attrName.startsWith('data-i18n') ||
                        attrName === 'data-i18n-placeholder' ||
                        attrName === 'data-i18n-title' ||
                        attrName === 'data-i18n-label'
                    )) {
                        shouldUpdate = true;
                    }
                }
            });

            if (shouldUpdate) {
                debouncedApplyTranslations();
            }
        });

        // 开始观察DOM变化
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-i18n', 'data-i18n-placeholder', 'data-i18n-title', 'data-i18n-label']
        });

        console.log('DOM变化观察器已启动');
    },

    // 基础翻译（如果翻译文件加载失败时使用）
    getBaseTranslations() {
        return {
        };
    }
};

// 导出 I18n 模块
window.I18n = I18n;