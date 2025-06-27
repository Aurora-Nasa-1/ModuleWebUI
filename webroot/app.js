/**
 * AMMF WebUI 主应用程序
 * 负责页面路由、UI管理、主题管理和应用状态
 */

// 应用程序主类
class App {
    constructor() {
        this.state = {
            isLoading: true,
            currentPage: null,
            themeChanging: false,
            headerTransparent: true,
            pagesConfig: null,
            currentTheme: 'light'
        };
        
        // 内部渲染缓存
        this.renderCache = new Map();
        this.templateCache = new Map();
        
        // 初始化主题
        this.initTheme();
    }
    // 防抖
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    /**
     * 初始化主题系统
     */
    initTheme() {
        // 检测系统主题偏好（包括 Android）
        const prefersDark = window.matchMedia && (
            window.matchMedia('(prefers-color-scheme: dark)').matches ||
            (window.navigator.userAgentData?.platform === 'Android' && 
             window.navigator.theme === 'dark')
        );
        
        this.state.currentTheme = prefersDark ? 'dark' : 'light';
        
        // 立即应用主题
        this.applyTheme(this.state.currentTheme);
        
        // 监听系统主题变化
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                this.setTheme(e.matches ? 'dark' : 'light');
            });
        }
    }
    
    /**
     * 应用主题
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.state.currentTheme = theme;
        
        // 更新主题颜色元标签
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
            metaThemeColor.setAttribute('content', primaryColor);
        }
        
        // 更新主题切换按钮图标
        this.updateThemeToggleIcon();
        
        // 触发主题变更事件
        document.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme }
        }));
    }
    
    /**
     * 设置主题
     */
    setTheme(theme) {
        this.applyTheme(theme);
    }
    
    /**
     * 切换主题
     */
    toggleTheme() {
        const newTheme = this.state.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }
    
    /**
     * 更新主题切换按钮图标
     */
    updateThemeToggleIcon() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const iconElement = themeToggle.querySelector('.material-symbols-rounded');
            if (iconElement) {
                iconElement.textContent = this.state.currentTheme === 'dark' ? 'dark_mode' : 'light_mode';
            }
            // 更新按钮标题
            themeToggle.title = I18n?.translate?.('THEME', '主题') || '主题';
        }
    }
    
    /**
     * 获取当前主题
     */
    getTheme() {
        return this.state.currentTheme;
    }
    
    /**
     * 检查是否为深色主题
     */
    isDarkTheme() {
        return this.state.currentTheme === 'dark';
    }
    
    /**
     * 检查是否为浅色主题
     */
    isLightTheme() {
        return this.state.currentTheme === 'light';
    }
    
    /**
     * 初始化系统按钮
     */
    initSystemButtons() {
        const systemButtonsContainer = document.getElementById('system-buttons');
        if (!systemButtonsContainer) {
            console.warn('系统按钮容器未找到');
            return;
        }
        
        // 渲染系统按钮
        const buttonsTemplate = `
            <button id="language-button" class="icon-button" title="${I18n?.translate?.('LANGUAGE', '语言') || '语言'}">
                <span class="material-symbols-rounded">translate</span>
            </button>
            <button id="theme-toggle" class="icon-button" title="${I18n?.translate?.('THEME', '主题') || '主题'}">
                <span class="material-symbols-rounded">${this.state.currentTheme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
            </button>
        `;
        
        systemButtonsContainer.innerHTML = buttonsTemplate;
        
        // 绑定事件
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        const languageButton = document.getElementById('language-button');
        if (languageButton) {
            languageButton.addEventListener('click', () => {
                this.showLanguageSelector();
            });
        }
    }
    
    /**
     * 高性能内部模板渲染引擎
     */
    renderTemplateInternal(template, context = {}, options = {}) {
        // 生成缓存键
        const cacheKey = this.generateCacheKey(template, context);
        
        // 检查缓存
        if (this.renderCache.has(cacheKey) && !options.forceRender) {
            return this.renderCache.get(cacheKey);
        }
        
        // 执行模板渲染
        let rendered = template;
        
        // 替换 ${key} 形式的变量
        rendered = rendered.replace(/\${([^}]+)}/g, (match, key) => {
            try {
                // 创建一个带有数据对象属性的上下文
                const renderContext = Object.assign({}, context, {
                    I18n: window.I18n || { translate: (key, fallback) => fallback },
                    app: this
                });
                
                // 使用Function构造函数创建一个可以访问上下文的函数
                const keys = Object.keys(renderContext);
                const values = Object.values(renderContext);
                const func = new Function(...keys, `return ${key};`);
                
                // 执行函数获取结果
                return func(...values) ?? '';
            } catch (error) {
                console.warn(`模板表达式解析错误: ${key}`, error);
                return '';
            }
        });
        
        // 替换 {{key}} 形式的变量（兼容性）
        rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const keys = key.trim().split('.');
            let value = context;
            
            for (const k of keys) {
                value = value?.[k];
                if (value === undefined) break;
            }
            
            return value !== undefined ? String(value) : match;
        });
        
        // 缓存结果
        if (options.cache !== false) {
            this.renderCache.set(cacheKey, rendered);
        }
        
        return rendered;
    }
    
    /**
     * 批量数据处理
     */
    processDataInternal(operation, data, options = {}) {
        switch (operation) {
            case 'FILTER':
                return this.filterData(data.data, data.filter);
            case 'SORT':
                return this.sortData(data.data, data.sortBy, data.order);
            case 'TRANSFORM':
                return this.transformData(data.data, data.transformer);
            case 'AGGREGATE':
                return this.aggregateData(data.data, data.aggregator);
            default:
                throw new Error(`未知数据操作: ${operation}`);
        }
    }
    
    /**
     * 过滤数据
     */
    filterData(data, filter) {
        if (!Array.isArray(data)) return data;
        
        return data.filter(item => {
            for (const [key, value] of Object.entries(filter)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }
    
    /**
     * 排序数据
     */
    sortData(data, sortBy, order = 'asc') {
        if (!Array.isArray(data)) return data;
        
        return [...data].sort((a, b) => {
            const aVal = a[sortBy];
            const bVal = b[sortBy];
            
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    /**
     * 转换数据
     */
    transformData(data, transformer) {
        if (typeof transformer === 'function') {
            return transformer(data);
        }
        return data;
    }
    
    /**
     * 聚合数据
     */
    aggregateData(data, aggregator) {
        if (!Array.isArray(data)) return data;
        
        return data.reduce((acc, item) => {
            return aggregator(acc, item);
        }, {});
    }
    
    /**
     * 生成缓存键
     */
    generateCacheKey(template, context) {
        const templateHash = this.simpleHash(template);
        const contextHash = this.simpleHash(JSON.stringify(context));
        return `${templateHash}-${contextHash}`;
    }
    
    /**
     * 简单哈希函数
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString(36);
    }
    
    /**
     * 清理渲染缓存
     */
    clearRenderCache() {
        this.renderCache.clear();
        this.templateCache.clear();
        console.log('渲染缓存已清理');
    }
    
    /**
     * 重新渲染指定页面
     * @param {string} pageName - 页面名称
     */
    async renderPage(pageName) {
        if (!pageName || this.state.currentPage !== pageName) {
            return;
        }
        
        try {
            // 清理渲染缓存
            this.clearRenderCache();
            
            // 获取页面模块
            const pageModule = window[Router.modules[pageName]];
            if (!pageModule) {
                console.warn(`页面模块未找到: ${pageName}`);
                return;
            }
            
            // 获取主内容容器
            const mainContent = document.getElementById('main-content');
            if (!mainContent) {
                console.warn('主内容容器未找到');
                return;
            }
            
            // 调用页面的onDeactivate方法（如果存在）
            if (typeof pageModule.onDeactivate === 'function') {
                pageModule.onDeactivate();
            }
            
            // 重新渲染页面内容
            if (typeof pageModule.render === 'function') {
                const pageContent = pageModule.render();
                mainContent.innerHTML = pageContent;
                
                // 调用页面的afterRender方法（如果存在）
                if (typeof pageModule.afterRender === 'function') {
                    await pageModule.afterRender();
                }
                
                // 重新应用翻译
                I18n.applyTranslations();
                
                // 更新页面操作按钮
                UI.updatePageActions(pageName);
                
                console.log(`页面 ${pageName} 重新渲染完成`);
            }
        } catch (error) {
            console.error(`重新渲染页面 ${pageName} 失败:`, error);
        }
    }
    
    /**
     * 获取缓存状态
     */
    getCacheStatus() {
        return {
            renderCacheSize: this.renderCache.size,
            templateCacheSize: this.templateCache.size,
            currentTheme: this.state.currentTheme,
            isLoading: this.state.isLoading
        };
    }
    
    // 初始化应用
    async init() {
        try {
            // 第一阶段：立即显示基础UI框架，减少白屏时间
            this.showInitialUI();
            
            // 第二阶段：并行初始化基础组件
            const [i18nResult, pagesConfig] = await Promise.allSettled([
                I18n.init(),
                this.loadPagesConfig()
            ]);
            
            // Initialize CSS loader
            if (window.CSSLoader) {
                CSSLoader.init();
            }
            
            // 第三阶段：初始化UI组件（非阻塞）
            this.initSystemButtons();
            UI.updateElementReferences();
            // 第四阶段：并行执行UI初始化任务
            const [navResult] = await Promise.allSettled([
                this.initNavigation()
            ]);
            
            // 导航初始化完成后，立即初始化布局管理器
            if (navResult.status === 'fulfilled') {
                UI.updateElementReferences();
                if (window.LayoutManager) {
                    LayoutManager.init();
                }
            }
            // 第五阶段：加载当前页面（优先级最高）
            const initialPage = Router.getCurrentPage();
            await Router.navigate(initialPage, false, true);
            
            // 第六阶段：异步完成剩余初始化任务
            this.completeInitializationAsync(i18nResult);
            
            // 第七阶段：完成加载，显示应用
            this.finishLoading();
            
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showInitializationError(error);
        }
    }
    
    /**
     * 显示初始UI框架
     */
    showInitialUI() {
        // 立即应用主题，避免闪烁
        this.applyTheme(this.state.currentTheme);
    }
    /**
     * 异步完成剩余初始化任务
     */
    completeInitializationAsync(i18nResult) {
        // 使用微任务确保不阻塞主线程
        Promise.resolve().then(async () => {
            // 监听i18n初始化完成事件
            document.addEventListener('i18nReady', () => {
                this.initLanguageSelector();
            }, { once: true });

            // 如果i18n已经初始化完成，直接初始化语言选择器
            if (i18nResult.status === 'fulfilled') {
                this.initLanguageSelector();
            }

            // 监听语言变化事件
            document.addEventListener('languageChanged', (event) => {
                const { language } = event.detail;
                this.handleLanguageChange(language);
            });
            
            // 异步加载页面模块（不阻塞主流程）
            this.loadPageModulesAsync();
            
            // 异步预加载其他页面
            this.schedulePreloading();
        });
    }
    
    /**
     * 异步加载页面模块
     */
    async loadPageModulesAsync() {
        if (!this.state.pagesConfig || !this.state.pagesConfig.pages) return;
        
        const currentPage = Router.getCurrentPage();
        const otherPages = this.state.pagesConfig.pages.filter(p => p.id !== currentPage);
        
        // 创建脚本加载函数
        const loadScript = (page) => {
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = page.file;
                script.async = true;
                script.onload = () => resolve(page);
                script.onerror = () => {
                    console.warn(`页面模块加载失败: ${page.file}`);
                    resolve(page);
                };
                document.head.appendChild(script);
            });
        };
        
        // 使用requestIdleCallback在空闲时加载
        if (otherPages.length > 0) {
            requestIdleCallback(() => {
                Promise.allSettled(otherPages.map(loadScript));
            }, { timeout: 500 });
        }
    }
    
    /**
     * 完成加载过程
     */
    finishLoading() {
        // 添加应用加载完成标记
        document.body.classList.add('app-loaded');
        
        // 更新加载状态
        this.state.isLoading = false;
    }
    

    /**
     * 显示初始化错误
     */
    showInitializationError(error) {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <h2>应用启动失败</h2>
                    <p>抱歉，应用在启动过程中遇到了问题。</p>
                    <details>
                        <summary>错误详情</summary>
                        <pre>${error.message}</pre>
                    </details>
                    <button onclick="location.reload()" class="retry-button">
                        重新加载
                    </button>
                </div>
            `;
        }
        
        if (window.UI && UI.showError) {
            UI.showError('应用初始化失败', error.message);
        }
    }
    
    // 调度预加载任务
    schedulePreloading() {
        if (this._pagesPreloaded) return;
        
        requestIdleCallback(() => {
            Router.preloadAllPages();
            this._pagesPreloaded = true;
        }, { timeout: 2000 });
    }

    /**
     * 加载页面配置
     */
    async loadPagesConfig() {
        try {
            const response = await fetch('pages.json');
            if (!response.ok) throw new Error(`加载页面配置失败: ${response.status}`);
            
            this.state.pagesConfig = await response.json();
            
            // 初始化Router模块映射
            Router.initModules(this.state.pagesConfig);
            
            return this.state.pagesConfig;
        } catch (error) {
            console.error('加载页面配置失败:', error);
            
            // 使用默认配置
            this.state.pagesConfig = {
                pages: [
                    {
                        id: "status",
                        name: "状态",
                        icon: "dashboard",
                        module: "StatusPage",
                        file: "pages/status.js"
                    }
                ],
                defaultPage: "status"
            };
            
            Router.initModules(this.state.pagesConfig);
            return this.state.pagesConfig;
        }
    }
    
    /**
     * 初始化底栏导航
     */
    async initNavigation() {
        if (!this.state.pagesConfig) return;
        
        const navElement = document.getElementById('app-nav');
        if (!navElement) return;
        
        const navContent = document.createElement('div');
        navContent.className = 'nav-content';
        
        // 创建导航项容器
        const navList = document.createElement('ul');
        
        // 创建导航项
        this.state.pagesConfig.pages.forEach(page => {
            const navItem = document.createElement('div');
            navItem.className = 'nav-item';
            navItem.dataset.page = page.id;
            
            if (page.id === this.state.pagesConfig.defaultPage) {
                navItem.classList.add('active');
            }
            
            navItem.innerHTML = `
                <span class="material-symbols-rounded">${page.icon}</span>
                <span class="nav-label" data-i18n="${page.i18n_key}">${page.name}</span>
            `;
            
            // 绑定点击事件
            navItem.addEventListener('click', () => {
                Router.navigate(page.id);
            });
            
            navList.appendChild(navItem);
        });
        
        navContent.appendChild(navList);
        navElement.appendChild(navContent);
    }
    
    /**
     * 加载页面模块JS文件
     */
    async loadPageModules() {
        if (!this.state.pagesConfig || !this.state.pagesConfig.pages) return;
        
        // 优先加载当前页面模块
        const currentPage = Router.getCurrentPage();
        const currentPageConfig = this.state.pagesConfig.pages.find(p => p.id === currentPage);
        const otherPages = this.state.pagesConfig.pages.filter(p => p.id !== currentPage);
        
        // 创建脚本加载函数
        const loadScript = (page) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = page.file;
                script.async = true; // 异步加载
                script.onload = () => resolve(page);
                script.onerror = () => {
                    console.error(`加载页面模块失败: ${page.file}`);
                    resolve(page); // 即使失败也继续，不阻塞其他模块
                };
                document.head.appendChild(script);
            });
        };
        
        try {
            // 优先加载当前页面模块
            if (currentPageConfig) {
                await loadScript(currentPageConfig);
            }
            
            // 批量并行加载其他页面模块（不阻塞主流程）
            if (otherPages.length > 0) {
                // 使用requestIdleCallback在空闲时加载
                requestIdleCallback(() => {
                    Promise.allSettled(otherPages.map(loadScript))
                        .then(results => {
                            const failed = results.filter(r => r.status === 'rejected');
                            if (failed.length > 0) {
                                console.warn('部分页面模块加载失败:', failed);
                            }
                        });
                }, { timeout: 1000 });
            }
        } catch (error) {
            console.error('加载页面模块出错:', error);
        }
    }

    // 执行命令
    async execCommand(command) {
        return await Core.execCommand(command);
    }

    /**
     * 渲染界面内容API
     * 支持模板字符串和数据绑定，动态渲染内容到指定容器
     * @param {string|HTMLElement} container - 容器选择器或DOM元素
     * @param {string} template - 模板字符串
     * @param {Object} data - 绑定数据
     * @param {Object} options - 渲染选项
     * @returns {HTMLElement} 渲染后的容器元素
     */
    renderUI(container, template, data = {}, options = {}) {
        // 获取容器元素
        const containerElement = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!containerElement) {
            console.error('渲染UI失败: 容器不存在', container);
            return null;
        }

        // 默认选项
        const defaultOptions = {
            append: false,        // 是否追加内容
            animate: true,        // 是否使用动画
            processEvents: true,  // 是否处理事件绑定
            clearFirst: !options.append, // 如果不是追加模式，默认先清空容器
            cache: true          // 是否缓存渲染结果
        };

        const renderOptions = { ...defaultOptions, ...options };

        // 使用内部高性能渲染引擎
        const processedTemplate = this.renderTemplateInternal(template, data, {
            cache: renderOptions.cache,
            forceRender: options.forceRender
        });

        // 清空容器或准备追加
        if (renderOptions.clearFirst) {
            containerElement.innerHTML = '';
        }

        // 创建临时容器解析HTML
        const temp = document.createElement('div');
        temp.innerHTML = processedTemplate;

        // 优化动画应用逻辑
        if (renderOptions.animate) {
            const children = Array.from(temp.children);
            // 使用 IntersectionObserver 监测元素可见性，只对可见元素应用动画
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        element.classList.add('fade-in');
                        // 使用 CSS变量控制延迟，避免JavaScript计算
                        element.style.setProperty('--animation-delay',
                            `${(Array.from(element.parentNode.children).indexOf(element) * 0.05)}s`);
                        observer.unobserve(element);
                    }
                });
            }, { threshold: 0.1 });

            children.forEach(child => observer.observe(child));
        }

        // 添加到容器
        if (renderOptions.append) {
            // 逐个添加子节点以保留事件绑定
            while (temp.firstChild) {
                containerElement.appendChild(temp.firstChild);
            }
        } else {
            containerElement.innerHTML = temp.innerHTML;
        }

        // 处理事件绑定
        if (renderOptions.processEvents) {
            this.processEventBindings(containerElement, data);
        }

        return containerElement;
    }

    /**
     * 处理元素中的事件绑定属性
     * 支持 data-on-click="methodName" 形式的声明式事件绑定
     * @param {HTMLElement} element - 要处理的元素
     * @param {Object} context - 事件处理上下文
     */
    processEventBindings(element, context = {}) {
        // 查找所有带有data-on-*属性的元素
        const eventElements = element.querySelectorAll('[data-on-click], [data-on-change], [data-on-input], [data-on-submit]');

        eventElements.forEach(el => {
            // 处理点击事件
            if (el.hasAttribute('data-on-click')) {
                const methodName = el.getAttribute('data-on-click');
                el.addEventListener('click', (event) => {
                    // 查找方法 - 先在上下文中查找，再在当前页面模块中查找
                    const method = context[methodName] ||
                        (window[Router.modules[app.state.currentPage]] &&
                            window[Router.modules[app.state.currentPage]][methodName]);

                    if (typeof method === 'function') {
                        method.call(context, event, el);
                    } else {
                        console.warn(`点击事件处理方法未找到: ${methodName}`);
                    }
                });
            }

            // 处理变更事件
            if (el.hasAttribute('data-on-change')) {
                const methodName = el.getAttribute('data-on-change');
                el.addEventListener('change', (event) => {
                    const method = context[methodName] ||
                        (window[Router.modules[app.state.currentPage]] &&
                            window[Router.modules[app.state.currentPage]][methodName]);

                    if (typeof method === 'function') {
                        method.call(context, event, el);
                    }
                });
            }

            // 处理输入事件
            if (el.hasAttribute('data-on-input')) {
                const methodName = el.getAttribute('data-on-input');
                el.addEventListener('input', (event) => {
                    const method = context[methodName] ||
                        (window[Router.modules[app.state.currentPage]] &&
                            window[Router.modules[app.state.currentPage]][methodName]);

                    if (typeof method === 'function') {
                        method.call(context, event, el);
                    }
                });
            }

            // 处理表单提交事件
            if (el.hasAttribute('data-on-submit')) {
                const methodName = el.getAttribute('data-on-submit');
                el.addEventListener('submit', (event) => {
                    event.preventDefault();
                    const method = context[methodName] ||
                        (window[Router.modules[app.state.currentPage]] &&
                            window[Router.modules[app.state.currentPage]][methodName]);

                    if (typeof method === 'function') {
                        method.call(context, event, el);
                    }
                });
            }
        });
    }

    /**
     * 渲染优化配置
     */
    static renderConfig = {
        batchSize: 10,  // 批量渲染的元素数量
        animationDelay: 50,  // 动画延迟基数(ms)
        observerThreshold: 0.1,  // 可见性检测阈值
        useIntersectionObserver: true  // 是否使用交叉观察器
    };

    /**
     * 配置渲染行为
     * @param {Object} config - 渲染配置
     */
    static configureRendering(config) {
        Object.assign(this.renderConfig, config);
    }

    /**
     * 批量渲染元素
     * @param {Array<Element>} elements - 要渲染的元素数组
     * @param {Function} renderCallback - 渲染回调
     */
    static batchRender(elements, renderCallback) {
        const batchSize = this.renderConfig.batchSize;
        let index = 0;

        const processBatch = () => {
            const batch = elements.slice(index, index + batchSize);
            if (batch.length === 0) return;

            batch.forEach(renderCallback);
            index += batchSize;

            if (index < elements.length) {
                requestAnimationFrame(processBatch);
            }
        };

        requestAnimationFrame(processBatch);
    }
    OpenUrl(url) {
        Core.execCommand(`am start -a android.intent.action.VIEW -d "${url}"`);
    }
    
    /**
     * 初始化语言选择器
     * 集成语言选择器的渲染和事件处理逻辑
     */
    initLanguageSelector() {
        const languageButton = document.getElementById('language-button');
        const languageSelector = document.getElementById('language-selector');
        
        if (!languageButton || !languageSelector) {
            console.warn('语言选择器元素未找到');
            return;
        }

        // 设置语言按钮点击事件
        languageButton.addEventListener('click', () => {
            this.showLanguageSelector();
        });

        // 添加点击遮罩关闭功能
        languageSelector.addEventListener('click', (event) => {
            if (event.target === languageSelector) {
                this.hideLanguageSelector();
            }
        });

        // 设置取消按钮点击事件
        const cancelButton = document.getElementById('cancel-language');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.hideLanguageSelector();
            });
        }

        // 初始化语言选项
        this.updateLanguageOptions();
        
        // 监听语言变化事件
        document.addEventListener('languageChanged', () => {
            this.updateLanguageOptions();
        });
    }

    // 处理语言变化
    handleLanguageChange(language) {
        // 清理渲染缓存确保新语言立即生效
        this.clearRenderCache();
        
        // 更新页面标题
        if (window.UI && typeof window.UI.updatePageTitle === 'function') {
            window.UI.updatePageTitle();
        }
        
        // 重新渲染系统按钮以更新标题和提示文本
        this.initSystemButtons();
        
        // 更新语言选择器选项
        this.updateLanguageOptions();
        
        // 更新导航栏标签
        this.updateNavigationLabels();
        
        // 强制重新应用翻译到所有元素
        if (window.I18n && typeof window.I18n.applyTranslations === 'function') {
            window.I18n.applyTranslations();
        }
        
        console.log(`UI已更新为语言: ${language}`);
    }
    
    /**
     * 显示语言选择器
     */
    showLanguageSelector() {
        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) {
            UI.showOverlay(languageSelector);
        }
    }
    
    /**
     * 隐藏语言选择器
     */
    hideLanguageSelector() {
        const languageSelector = document.getElementById('language-selector');
        if (!languageSelector || languageSelector.classList.contains('closing')) return;

        languageSelector.classList.add('closing');

        setTimeout(() => {
            languageSelector.classList.remove('active', 'closing');
        }, 200);
    }
    
    /**
     * 更新语言选项
     */
    updateLanguageOptions() {
        const languageOptions = document.getElementById('language-options');
        if (!languageOptions || !window.I18n) return;

        const fragment = document.createDocumentFragment();

        I18n.supportedLangs.forEach(lang => {
            const option = document.createElement('div');
            option.className = `language-option ${lang === I18n.currentLang ? 'selected' : ''}`;
            option.setAttribute('data-lang', lang);

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'language';
            radioInput.id = `lang-${lang}`;
            radioInput.value = lang;
            radioInput.checked = lang === I18n.currentLang;
            radioInput.className = 'radio';

            const label = document.createElement('label');
            label.htmlFor = `lang-${lang}`;
            label.textContent = this.getLanguageDisplayName(lang);

            option.appendChild(radioInput);
            option.appendChild(label);

            option.addEventListener('click', async () => {
                if (lang === I18n.currentLang) {
                    this.hideLanguageSelector();
                    return;
                }

                this.hideLanguageSelector();
                
                // 显示切换提示
                if (window.Core && typeof window.Core.showToast === 'function') {
                    window.Core.showToast(I18n.translate('SWITCHING_LANGUAGE', '正在切换语言...'));
                }
                
                if (lang !== I18n.currentLang) {
                    const success = await I18n.setLanguage(lang);
                    if (success && window.Core && typeof window.Core.showToast === 'function') {
                        // 使用新语言显示成功提示
                        setTimeout(() => {
                            window.Core.showToast(I18n.translate('LANGUAGE_SWITCHED', '语言切换成功'));
                        }, 100);
                    }
                }
            });

            fragment.appendChild(option);
        });
        
        languageOptions.innerHTML = '';
        languageOptions.appendChild(fragment);
    }
    
    /**
     * 更新导航栏标签
     */
    updateNavigationLabels() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(navItem => {
            const label = navItem.querySelector('.nav-label');
            if (label && label.hasAttribute('data-i18n')) {
                const i18nKey = label.getAttribute('data-i18n');
                const translation = I18n.translate(i18nKey);
                if (translation) {
                    label.textContent = translation;
                }
            }
        });
    }
    
    /**
     * 获取语言显示名称
     */
    getLanguageDisplayName(lang) {
        const displayNames = {
            'zh': '中文',
            'en': 'English', 
            'ru': 'Русский'
        };
        return displayNames[lang] || lang.toUpperCase();
    }
}
class PreloadManager {
    static dataCache = new Map();
    static loadingPromises = new Map();

    /**
     * 注册页面数据预加载
     * @param {string} pageName - 页面名称
     * @param {Function} loader - 数据加载函数
     */
    static registerDataLoader(pageName, loader) {
        if (typeof loader !== 'function') return;
        this.loadingPromises.set(pageName, loader);
    }

    /**
     * 预加载页面数据
     * @param {string} pageName - 页面名称
     * @returns {Promise} 加载结果
     */
    static async preloadData(pageName) {
        if (this.dataCache.has(pageName)) return this.dataCache.get(pageName);

        const loader = this.loadingPromises.get(pageName);
        if (!loader) return null;

        try {
            const data = await loader();
            this.dataCache.set(pageName, data);
            return data;
        } catch (error) {
            console.warn(`预加载数据失败: ${pageName}`, error);
            return null;
        }
    }

    /**
     * 获取预加载的数据
     * @param {string} pageName - 页面名称
     * @returns {any} 缓存的数据
     */
    static getData(pageName) {
        return this.dataCache.get(pageName);
    }

    /**
     * 清除页面数据缓存
     * @param {string} pageName - 页面名称
     */
    static clearCache(pageName) {
        this.dataCache.delete(pageName);
    }
}
// 路由管理器
class Router {
    // 页面模块映射
    static modules = {};

    // 页面模块缓存
    static pageCache = {};
    
    // 加载中的Promise缓存
    static loadingPromises = {};
    
    // 数据缓存
    static dataCache = new Map();
    
    /**
     * 初始化模块映射
     * @param {Object} config - 页面配置对象
     */
    static initModules(config) {
        if (!config || !config.pages) return;
        
        // 清空现有模块映射
        this.modules = {};
        
        // 更新模块映射
        config.pages.forEach(page => {
            this.modules[page.id] = page.module;
        });
    }

    // 获取当前页面
    static getCurrentPage() {
        const hash = window.location.hash.slice(1);
        return this.modules[hash] ? hash : (app.state.pagesConfig?.defaultPage || 'status');
    }
    
    static preloadConfig = {
        batchSize: 2,
        timeout: 2000,
        preloadData: true
    };

    /**
     * 预加载单个页面
     * @param {string} pageName - 页面名称
     */
    static async preloadPage(pageName) {
        if (this.pageCache[pageName]) return;

        const pageModule = window[this.modules[pageName]];
        if (!pageModule) return;

        const tasks = [];

        // 初始化页面模块
        if (pageModule.init && !pageModule._initializing) {
            pageModule._initializing = true;
            tasks.push((async () => {
                try {
                    await pageModule.init();
                    this.pageCache[pageName] = pageModule;
                } finally {
                    delete pageModule._initializing;
                }
            })());
        }

        // 预加载页面数据
        if (this.preloadConfig.preloadData && pageModule.preloadData) {
            tasks.push(PreloadManager.preloadData(pageName));
        }

        await Promise.allSettled(tasks);
    }

    static preloadAllPages() {
        if (!app.state.pagesConfig || !app.state.pagesConfig.pages) return;
        
        const { batchSize, timeout } = this.preloadConfig;
        const currentPage = app.state.currentPage;

        // 获取要加载的页面
        const pagesToLoad = app.state.pagesConfig.pages
            .map(page => page.id)
            .filter(pageId => pageId !== currentPage);

        const preloadBatch = async (startIndex) => {
            const batch = pagesToLoad.slice(startIndex, startIndex + batchSize);
            if (batch.length === 0) return;

            await Promise.allSettled(
                batch.map(page => this.preloadPage(page))
            );

            if (startIndex + batchSize < pagesToLoad.length) {
                requestIdleCallback(
                    () => preloadBatch(startIndex + batchSize),
                    { timeout }
                );
            }
        };

        requestIdleCallback(() => preloadBatch(0), { timeout });
    }

    /**
     * 导航到指定页面
     * @param {string} pageName - 页面名称
     * @param {boolean} updateHistory - 是否更新历史记录
     * @param {boolean} isInitialLoad - 是否是首次加载
     */
    static async navigate(pageName, updateHistory = true, isInitialLoad = false) {
        try {
            if (app.state.currentPage === pageName && !isInitialLoad) return;



            // 并行执行多个操作以提升性能
            const [elements, pageModule] = await Promise.all([
                Promise.resolve(this.getNavigationElements()),
                this.loadPageModuleOptimized(pageName)
            ]);
            
            // 处理旧页面的deactivate（非阻塞）
            this.deactivateCurrentPage().catch(error => 
                console.warn('页面停用失败:', error)
            );

            // 立即更新应用状态和导航，确保UI同步
            app.state.currentPage = pageName;
            UI.updateNavigation(pageName);
            
            // 更新历史记录
            if (updateHistory) {
                window.history.pushState(null, '', `#${pageName}`);
            }

            // 使用高性能内部渲染引擎渲染页面内容
            const newContainer = await this.createPageContainerOptimized(pageModule, pageName);

            // 执行页面过渡
            await this.performPageTransition(newContainer, elements.oldContainer, pageName);

            // 执行渲染后回调和激活
            await this.activateNewPage(pageModule, pageName);

            // 预加载相邻页面
            this.preloadAdjacentPages(pageName);

        } catch (error) {
            console.error('页面导航错误:', error);
            UI.showError('页面加载失败', error.message);
        }
    }
    
    /**
     * 批量获取导航相关的DOM元素
     */
    static getNavigationElements() {
        return {
            headerTitle: document.querySelector('.header-title'),
            pageActions: document.querySelector('.page-actions'),
            oldContainer: document.querySelector('.page-container'),
            mainContent: document.getElementById('main-content')
        };
    }
    
    /**
     * 停用当前页面
     */
    static async deactivateCurrentPage() {
        if (!app.state.currentPage) return;
        
        const currentPageModule = this.pageCache[app.state.currentPage] ||
            window[this.modules[app.state.currentPage]];
        
        if (currentPageModule?.onDeactivate) {
            try {
                await currentPageModule.onDeactivate();
            } catch (error) {
                console.warn('页面停用失败:', error);
            }
        }
    }
    
    /**
     * 加载页面模块
     */
    static async loadPageModule(pageName) {
        // 检查缓存
        if (this.pageCache[pageName]) {
            return this.pageCache[pageName];
        }
        
        const pageModule = window[this.modules[pageName]];
        if (!pageModule) {
            throw new Error(`页面模块 ${pageName} 未找到`);
        }

        // 初始化模块（如果需要）
        if (!pageModule._initialized && typeof pageModule.init === 'function') {
            pageModule._initializing = true;
            try {
                const initResult = await pageModule.init();
                if (initResult === false) {
                    throw new Error(`页面 ${pageName} 初始化失败`);
                }
                pageModule._initialized = true;
                this.pageCache[pageName] = pageModule;
            } finally {
                delete pageModule._initializing;
            }
        }
        
        return pageModule;
    }

    /**
      * 优化的页面模块加载
      * @param {string} pageName - 页面名称
      * @returns {Promise<Object>} 页面模块
      */
     static async loadPageModuleOptimized(pageName) {
         // 检查缓存
         if (this.pageCache[pageName]) {
             return this.pageCache[pageName];
         }

         // 检查是否正在加载中
         if (this.loadingPromises && this.loadingPromises[pageName]) {
             return await this.loadingPromises[pageName];
         }

         // 创建加载Promise
         if (!this.loadingPromises) {
             this.loadingPromises = {};
         }

         this.loadingPromises[pageName] = this.loadPageModuleInternal(pageName);
         
         try {
             const pageModule = await this.loadingPromises[pageName];
             delete this.loadingPromises[pageName];
             return pageModule;
         } catch (error) {
             delete this.loadingPromises[pageName];
             throw error;
         }
     }

    /**
      * 内部页面模块加载方法
      * @param {string} pageName - 页面名称
      * @returns {Promise<Object>} 页面模块
      */
     static async loadPageModuleInternal(pageName) {
         // 动态导入页面模块
         await import(`./pages/${pageName}.js`);
         
         // 获取页面模块（从window对象）
         const moduleKey = this.modules[pageName];
         const pageModule = window[moduleKey];
         
         if (!pageModule) {
             throw new Error(`页面模块 ${moduleKey} 未找到`);
         }
         
         // 并行执行初始化和数据预加载
         const initPromises = [];
         
         if (pageModule.init && !pageModule._initialized) {
             pageModule._initializing = true;
             initPromises.push(pageModule.init().then(result => {
                 if (result === false) {
                     throw new Error(`页面 ${pageName} 初始化失败`);
                 }
                 pageModule._initialized = true;
                 delete pageModule._initializing;
             }));
         }
         
         // 预加载页面数据
         if (pageModule.preloadData) {
             initPromises.push(pageModule.preloadData().catch(error => {
                 console.warn(`页面 ${pageName} 数据预加载失败:`, error);
             }));
         }
         
         await Promise.all(initPromises);

         // 缓存页面模块
         this.pageCache[pageName] = pageModule;
         return pageModule;
     }
    
    /**
     * 创建页面容器
     */
    static createPageContainer(pageModule) {
        const newContainer = document.createElement('div');
        newContainer.className = 'page-container';
        newContainer.innerHTML = pageModule.render();
        return newContainer;
    }

    /**
     * 优化的页面容器创建
     * @param {Object} pageModule - 页面模块
     * @param {string} pageName - 页面名称
     * @returns {Promise<HTMLElement>} 页面容器
     */
    static async createPageContainerOptimized(pageModule, pageName) {
        const newContainer = document.createElement('div');
        newContainer.className = 'page-container';
        
        // 使用高性能内部渲染
        if (pageModule.renderAsync) {
            try {
                const content = await pageModule.renderAsync();
                newContainer.innerHTML = content;
            } catch (error) {
                console.warn('异步渲染失败，回退到同步渲染:', error);
                newContainer.innerHTML = pageModule.render();
            }
        } else {
            newContainer.innerHTML = pageModule.render();
        }
        
        return newContainer;
    }
    
    /**
     * 激活新页面
     */
    static async activateNewPage(pageModule, pageName) {
        // 执行渲染后回调
        if (pageModule.afterRender) {
            try {
                await pageModule.afterRender();
            } catch (error) {
                console.warn('页面渲染后回调失败:', error);
            }
        }

        // 执行激活方法
        if (pageModule.onActivate) {
            try {
                await pageModule.onActivate();
            } catch (error) {
                console.warn('页面激活失败:', error);
            }
        }

        // 批量更新UI
        this.updateUIForNewPage(pageName);
    }
    
    /**
     * 批量更新UI状态 - 优化为并行非阻塞处理
     */
    static updateUIForNewPage(pageName) {
        // 导航状态已在navigate方法中提前更新，这里只更新其他UI元素
        // 使用并行处理，避免阻塞页面切换
        requestAnimationFrame(() => {
            // 并行更新标题和操作按钮，不等待完成
            Promise.allSettled([
                Promise.resolve(UI.updatePageTitle(pageName)),
                Promise.resolve(UI.updatePageActions(pageName))
            ]).catch(error => {
                console.warn('UI更新失败:', error);
            });
        });
    }

    // 页面过渡效果 - 优化为非阻塞并行处理
    static async performPageTransition(newContainer, oldContainer, newPageName) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;
        
        // 直接移除旧容器，简化过渡逻辑
        if (oldContainer) {
            oldContainer.remove();
        }

        // 添加新容器
        mainContent.appendChild(newContainer);

        // 使用CSS动画优化过渡效果，匹配新的动画时长
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                newContainer.classList.add('slide-in');
                // 匹配新的150ms动画时长
                setTimeout(resolve, 150);
            });
        });
    }



    /**
     * 预加载相邻页面
     * @param {string} currentPageName - 当前页面名称
     */
    static preloadAdjacentPages(currentPageName) {
        if (!app.state.pagesConfig || !app.state.pagesConfig.pages) return;
        
        const pages = app.state.pagesConfig.pages;
        const currentIndex = pages.findIndex(page => page.id === currentPageName);
        
        if (currentIndex === -1) return;
        
        // 预加载前后页面
        const adjacentPages = [];
        if (currentIndex > 0) {
            adjacentPages.push(pages[currentIndex - 1].id);
        }
        if (currentIndex < pages.length - 1) {
            adjacentPages.push(pages[currentIndex + 1].id);
        }
        
        // 异步预加载
        requestIdleCallback(() => {
            adjacentPages.forEach(pageId => {
                this.preloadPage(pageId).catch(error => {
                    console.warn(`预加载页面 ${pageId} 失败:`, error);
                });
            });
        }, { timeout: 1000 });
     }

     /**
      * 预加载指定页面
      * @param {string} pageName - 页面名称
      * @returns {Promise<void>}
      */
     static async preloadPage(pageName) {
         try {
             // 检查是否已经缓存
             if (this.pageCache[pageName]) {
                 return;
             }

             // 预加载页面模块
             await this.loadPageModuleOptimized(pageName);
             
             // 使用内部缓存预处理页面模板
            const pageModule = this.pageCache[pageName];
            if (pageModule && pageModule.getTemplate) {
                const template = pageModule.getTemplate();
                app.templateCache.set(pageName, template);
            }
             
             console.log(`页面 ${pageName} 预加载完成`);
         } catch (error) {
             console.warn(`预加载页面 ${pageName} 失败:`, error);
         }
     }

     /**
      * 批量预加载页面
      * @param {string[]} pageNames - 页面名称数组
      * @returns {Promise<void>}
      */
     static async preloadPages(pageNames) {
         const preloadPromises = pageNames.map(pageName => 
             this.preloadPage(pageName).catch(error => {
                 console.warn(`预加载页面 ${pageName} 失败:`, error);
             })
         );
         
         await Promise.allSettled(preloadPromises);
     }
 }

/**
 * 布局管理器 - 负责处理横竖屏切换和元素布局
 */
class LayoutManager {
    static state = {
        currentMode: null, // 'landscape' | 'portrait'
        isTransitioning: false,
        elementPositions: new Map(), // 记录元素的原始位置
        containers: new Map() // 缓存容器引用
    };

    /**
     * 初始化布局管理器
     */
    static init() {
        this.cacheContainers();
        this.bindEvents();
        // 强制执行初始布局切换，确保初始状态正确
        this.state.currentMode = null;
        this.updateLayout();
    }

    /**
     * 检测初始模式
     */
    static detectInitialMode() {
        this.state.currentMode = window.innerWidth >= 768 ? 'landscape' : 'portrait';
    }

    /**
     * 缓存容器引用
     */
    static cacheContainers() {
        const containers = {
            // 顶栏容器
            header: document.querySelector('.app-header'),
            headerActions: document.querySelector('.header-actions'),
            systemButtons: document.querySelector('#system-buttons'),
            
            // 侧栏容器
            appNav: document.querySelector('#app-nav'),
            navContent: null, // 动态获取
            
            // 动态容器（会被创建）
            sidebarPageActions: null,
            sidebarSystemActions: null
        };
        
        this.state.containers = new Map(Object.entries(containers));
    }

    /**
     * 绑定事件监听器
     */
    static bindEvents() {
        let resizeTimeout;
        
        // 窗口大小变化事件（防抖）
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });
        
        // 屏幕方向变化事件
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 300);
        });
    }

    /**
     * 处理窗口大小变化
     */
    static handleResize() {
        const newMode = window.innerWidth >= 768 ? 'landscape' : 'portrait';
        
        if (newMode !== this.state.currentMode) {
            this.switchMode(newMode);
        }
    }

    /**
     * 处理屏幕方向变化
     */
    static handleOrientationChange() {
        // 重新缓存容器（可能DOM结构发生变化）
        this.cacheContainers();
        this.handleResize();
    }

    /**
     * 切换布局模式
     */
    static switchMode(newMode) {
        if (this.state.isTransitioning) return;
        
        this.state.isTransitioning = true;
        const oldMode = this.state.currentMode;
        
        console.log(`布局切换: ${oldMode} -> ${newMode}`);
        
        // 执行切换逻辑
        if (newMode === 'landscape') {
            this.switchToLandscape();
        } else {
            this.switchToPortrait();
        }
        
        this.state.currentMode = newMode;
        this.state.isTransitioning = false;
        
        // 触发布局变化事件
        this.dispatchLayoutChangeEvent(oldMode, newMode);
    }

    /**
     * 切换到横屏模式
     */
    static switchToLandscape() {
        console.log('切换到横屏模式');
        
        // 1. 确保侧栏容器存在
        this.ensureSidebarContainers();
        
        // 2. 移动页面操作按钮到侧栏
        this.movePageActionsToSidebar();
        
        // 3. 移动系统按钮到侧栏
        this.moveSystemButtonsToSidebar();
        
        // 4. 更新容器状态
        this.updateContainerStates('landscape');
    }

    /**
     * 切换到竖屏模式
     */
    static switchToPortrait() {
        console.log('切换到竖屏模式');
        
        // 1. 移动页面操作按钮回顶栏
        this.movePageActionsToHeader();
        
        // 2. 移动系统按钮回顶栏
        this.moveSystemButtonsToHeader();
        
        // 3. 清理侧栏容器
        this.cleanupSidebarContainers();
        
        // 4. 更新容器状态
        this.updateContainerStates('portrait');
    }

    /**
     * 确保侧栏容器存在
     */
    static ensureSidebarContainers() {
        const appNav = this.state.containers.get('appNav');
        if (!appNav) return;
        
        let navContent = appNav.querySelector('.nav-content');
        if (!navContent) {
            console.warn('nav-content 容器不存在');
            return;
        }
        
        this.state.containers.set('navContent', navContent);
        
        // 创建或获取页面操作容器
        let pageActionsContainer = navContent.querySelector('.page-actions');
        if (!pageActionsContainer) {
            pageActionsContainer = this.createSidebarContainer('page-actions');
            this.insertContainerInSidebar(pageActionsContainer, 'page-actions');
        }
        this.state.containers.set('sidebarPageActions', pageActionsContainer);
        
        // 创建或获取系统按钮容器
        let systemActionsContainer = navContent.querySelector('.system-actions');
        if (!systemActionsContainer) {
            systemActionsContainer = this.createSidebarContainer('system-actions');
            this.insertContainerInSidebar(systemActionsContainer, 'system-actions');
        }
        this.state.containers.set('sidebarSystemActions', systemActionsContainer);
    }

    /**
     * 创建侧栏容器
     */
    static createSidebarContainer(type) {
        const container = document.createElement('div');
        container.className = type;
        container.setAttribute('data-layout-container', type);
        return container;
    }

    /**
     * 在侧栏中插入容器
     */
    static insertContainerInSidebar(container, type) {
        const navContent = this.state.containers.get('navContent');
        if (!navContent) return;
        
        if (type === 'page-actions') {
            // 页面操作容器插入到导航列表之后
            const navList = navContent.querySelector('ul');
            if (navList) {
                navList.insertAdjacentElement('afterend', container);
            } else {
                navContent.appendChild(container);
            }
        } else if (type === 'system-actions') {
            // 系统按钮容器插入到最后
            navContent.appendChild(container);
        }
    }

    /**
     * 移动页面操作按钮到侧栏
     */
    static movePageActionsToSidebar() {
        const pageActions = document.getElementById('page-actions');
        const sidebarContainer = this.state.containers.get('sidebarPageActions');
        
        if (pageActions && sidebarContainer) {
            this.moveElement(pageActions, sidebarContainer, 'clear');
        }
    }

    /**
     * 移动系统按钮到侧栏
     */
    static moveSystemButtonsToSidebar() {
        const systemContainer = this.state.containers.get('sidebarSystemActions');
        if (!systemContainer) return;
        
        const buttons = [
            document.getElementById('language-button'),
            document.getElementById('theme-toggle')
        ];
        
        buttons.forEach(button => {
            if (button) {
                this.moveElement(button, systemContainer);
            }
        });
    }

    /**
     * 移动页面操作按钮回顶栏
     */
    static movePageActionsToHeader() {
        const pageActions = document.getElementById('page-actions');
        const headerActions = this.state.containers.get('headerActions');
        const systemButtons = this.state.containers.get('systemButtons');
        
        if (pageActions && headerActions) {
            // 插入到系统按钮之前
            const insertBefore = systemButtons || headerActions.firstChild;
            this.moveElement(pageActions, headerActions, 'insertBefore', insertBefore);
        }
    }

    /**
     * 移动系统按钮回顶栏
     */
    static moveSystemButtonsToHeader() {
        const systemButtons = this.state.containers.get('systemButtons');
        if (!systemButtons) return;
        
        const buttons = [
            document.getElementById('language-button'),
            document.getElementById('theme-toggle')
        ];
        
        buttons.forEach(button => {
            if (button) {
                this.moveElement(button, systemButtons);
            }
        });
    }

    /**
     * 移动元素到指定容器
     */
    static moveElement(element, targetContainer, mode = 'append', insertBefore = null) {
        if (!element || !targetContainer) return;
        
        // 记录原始位置（如果还没记录）
        if (!this.state.elementPositions.has(element.id)) {
            this.state.elementPositions.set(element.id, {
                parent: element.parentNode,
                nextSibling: element.nextSibling
            });
        }
        
        // 从当前位置移除
        if (element.parentNode && element.parentNode !== targetContainer) {
            element.parentNode.removeChild(element);
        }
        
        // 添加到目标容器
        if (!targetContainer.contains(element)) {
            switch (mode) {
                case 'clear':
                    targetContainer.innerHTML = '';
                    targetContainer.appendChild(element);
                    break;
                case 'insertBefore':
                    if (insertBefore) {
                        targetContainer.insertBefore(element, insertBefore);
                    } else {
                        targetContainer.appendChild(element);
                    }
                    break;
                default:
                    targetContainer.appendChild(element);
            }
        }
    }

    /**
     * 清理侧栏容器
     */
    static cleanupSidebarContainers() {
        const containers = ['sidebarPageActions', 'sidebarSystemActions'];
        
        containers.forEach(containerKey => {
            const container = this.state.containers.get(containerKey);
            if (container && container.parentNode) {
                // 不删除容器，只清空内容，保持DOM结构稳定
                container.innerHTML = '';
            }
        });
    }

    /**
     * 更新容器状态
     */
    static updateContainerStates(mode) {
        document.body.setAttribute('data-layout-mode', mode);
        
        // 触发CSS重新计算
        requestAnimationFrame(() => {
            document.body.classList.add('layout-updated');
            setTimeout(() => {
                document.body.classList.remove('layout-updated');
            }, 300);
        });
    }

    /**
     * 触发布局变化事件
     */
    static dispatchLayoutChangeEvent(oldMode, newMode) {
        const event = new CustomEvent('layoutModeChanged', {
            detail: { oldMode, newMode, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }

    /**
     * 强制更新布局
     */
    static updateLayout() {
        this.cacheContainers();
        const currentMode = window.innerWidth >= 768 ? 'landscape' : 'portrait';
        
        if (currentMode !== this.state.currentMode || this.state.currentMode === null) {
            this.switchMode(currentMode);
        }
    }

    /**
     * 获取当前布局模式
     */
    static getCurrentMode() {
        return this.state.currentMode;
    }

    /**
     * 检查是否为横屏模式
     */
    static isLandscape() {
        return this.state.currentMode === 'landscape';
    }

    /**
     * 检查是否为竖屏模式
     */
    static isPortrait() {
        return this.state.currentMode === 'portrait';
    }

    /**
     * 重置布局管理器
     */
    static reset() {
        this.state.currentMode = null;
        this.state.isTransitioning = false;
        this.state.elementPositions.clear();
        this.state.containers.clear();
        
        this.init();
    }

    /**
     * 获取调试信息
     */
    static getDebugInfo() {
        return {
            currentMode: this.state.currentMode,
            isTransitioning: this.state.isTransitioning,
            elementPositions: Array.from(this.state.elementPositions.entries()),
            containers: Array.from(this.state.containers.keys()),
            windowWidth: window.innerWidth
        };
    }
}

// UI管理类
class UI {
    // UI元素引用
    static elements = {
        app: document.getElementById('app'),
        header: document.querySelector('.app-header'),
        mainContent: document.getElementById('main-content'),
        navContent: document.querySelector('.nav-content'),
        pageTitle: document.getElementById('page-title'),
        pageActions: document.getElementById('page-actions'),
        themeToggle: document.getElementById('theme-toggle'),
        languageButton: document.getElementById('language-button'),
        toastContainer: document.getElementById('toast-container'),
        appNav: document.getElementById('app-nav')
    };

    // 更新UI元素引用
    static updateElementReferences() {
        this.elements.themeToggle = document.getElementById('theme-toggle');
        this.elements.languageButton = document.getElementById('language-button');
        this.elements.pageActions = document.getElementById('page-actions');
        this.elements.pageTitle = document.getElementById('page-title');
        this.elements.navContent = document.querySelector('.nav-content');
    }

    // 更新页面标题 - 添加非阻塞淡入淡出动画
    static updatePageTitle(pageName) {
        if (!app.state.pagesConfig || !app.state.pagesConfig.pages) return;
        
        // 查找页面配置
        const pageConfig = app.state.pagesConfig.pages.find(p => p.id === pageName);
        if (!pageConfig) return;
        
        const title = pageConfig.i18n_key 
            ? I18n.translate(pageConfig.i18n_key, pageConfig.name)
            : pageConfig.name;

        // 检查pageTitle元素是否存在，避免TypeError
        if (this.elements.pageTitle) {
            const titleElement = this.elements.pageTitle;
            const headerTitleElement = document.querySelector('.header-title');
            
            // 使用requestAnimationFrame确保非阻塞处理
            requestAnimationFrame(() => {
                // 如果标题有内容且不同，先添加淡出动画
                if (titleElement.textContent && titleElement.textContent !== title) {
                    // 对header-title容器应用动画
                    if (headerTitleElement) {
                        headerTitleElement.classList.add('fade-out');
                    }
                    
                    // 等待淡出动画完成后更新标题
                    setTimeout(() => {
                        titleElement.textContent = title || 'AMMF WebUI';
                        if (headerTitleElement) {
                            headerTitleElement.classList.remove('fade-out');
                            headerTitleElement.classList.add('fade-in');
                            
                            // 动画完成后清理动画类
                            setTimeout(() => {
                                headerTitleElement.classList.remove('fade-in');
                            }, 150); // 匹配fade-in动画时长
                        }
                    }, 120); // 匹配fade-out动画时长
                } else {
                    // 如果没有现有标题或标题相同，直接设置
                    titleElement.textContent = title || 'AMMF WebUI';
                }
            });
        }
    }
    
    static pageActions = new Map();
    static activeActions = new Set();

    /**
     * 注册页面操作按钮
     * @param {string} pageName - 页面名称
     * @param {Array<Object>} actions - 操作按钮配置数组
     */
    static registerPageActions(pageName, actions) {
        // 验证按钮配置
        const validActions = actions.filter(action => {
            if (!action.id || !action.icon) {
                console.warn(`操作按钮配置无效: ${JSON.stringify(action)}`);
                return false;
            }
            return true;
        });

        this.pageActions.set(pageName, validActions);

        // 如果是当前页面，立即更新按钮
        if (app.state.currentPage === pageName) {
            this.updatePageActions(pageName);
        }
    }

    /**
     * 更新页面操作按钮 - 添加淡入淡出动画
     * @param {string} pageName - 页面名称
     */
    static updatePageActions(pageName) {
        const actionsContainer = this.elements.pageActions;
        if (!actionsContainer) return;

        // 先添加淡出动画
        if (actionsContainer.children.length > 0) {
            actionsContainer.classList.add('fade-out');
            
            // 等待淡出动画完成后更新内容
            setTimeout(() => {
                this.updatePageActionsContent(pageName, actionsContainer);
            }, 120); // 匹配fade-out动画时长
        } else {
            // 如果没有现有内容，直接更新
            this.updatePageActionsContent(pageName, actionsContainer);
        }
    }

    /**
     * 更新页面操作按钮内容
     * @param {string} pageName - 页面名称
     * @param {HTMLElement} actionsContainer - 操作按钮容器
     */
    static updatePageActionsContent(pageName, actionsContainer) {
        // 清理之前的事件监听器
        this.activeActions.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.replaceWith(button.cloneNode(true));
            }
        });
        this.activeActions.clear();

        const actions = this.pageActions.get(pageName) || [];
        actionsContainer.innerHTML = actions.map(action => `
            <button id="${action.id}" 
                    class="icon-button ${action.disabled?.() ? 'disabled' : ''}" 
                    title="${action.title}">
                <span class="material-symbols-rounded">${action.icon}</span>
            </button>
        `).join('');

        // 移除淡出类并添加淡入动画
        actionsContainer.classList.remove('fade-out');
        if (actions.length > 0) {
            actionsContainer.classList.add('fade-in');
            // 动画完成后清理动画类
            setTimeout(() => {
                actionsContainer.classList.remove('fade-in');
            }, 150); // 匹配fade-in动画时长
        }

        // 绑定事件
        actions.forEach(action => {
            const button = document.getElementById(action.id);
            if (button && action.onClick) {
                this.activeActions.add(action.id);
                button.addEventListener('click', () => {
                    const pageModule = window[Router.modules[pageName]];
                    if (pageModule && typeof pageModule[action.onClick] === 'function') {
                        if (!action.disabled?.()) {
                            pageModule[action.onClick]();
                        }
                    }
                });

                // 如果有禁用状态检查函数，添加定期检查
                if (action.disabled) {
                    const updateDisabled = () => {
                        const isDisabled = action.disabled();
                        button.classList.toggle('disabled', isDisabled);
                    };
                    updateDisabled(); // 初始检查
                    // 添加到更新队列
                    if (this.buttonStateInterval) {
                        clearInterval(this.buttonStateInterval);
                    }
                    this.buttonStateInterval = setInterval(updateDisabled, 1000);
                }
            }
        });
    }

    /**
     * 显示浮层
     * @param {HTMLElement} element - 要显示的浮层元素
     */
    static showOverlay(element) {
        if (!element) return;
        element.classList.add('active');
    }
    
    /**
     * 隐藏浮层
     * @param {HTMLElement} element - 要隐藏的浮层元素
     */
    static hideOverlay(element) {
        if (!element) return;
        element.classList.remove('active');
    }

    /**
     * 清理页面操作按钮
     * @param {string} [pageName] - 页面名称，可选。如果不提供，则只清理当前活动的按钮
     */
    static clearPageActions(pageName) {
        // 清理事件监听器
        this.activeActions.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.replaceWith(button.cloneNode(true));
            }
        });
        this.activeActions.clear();

        // 清理状态更新定时器
        if (this.buttonStateInterval) {
            clearInterval(this.buttonStateInterval);
            this.buttonStateInterval = null;
        }

        // 清空按钮容器
        const actionsContainer = this.elements.pageActions;
        if (actionsContainer) {
            actionsContainer.innerHTML = '';
        }

        // 移除页面按钮配置
        if (pageName) {
            this.pageActions.delete(pageName);
        }
    }

    // 显示错误信息
    static showError(title, message) {
        this.elements.mainContent.innerHTML = `
            <div class="page-container">
                <div class="error-container">
                    <h2>${title}</h2>
                    <p>${message}</p>
                </div>
            </div>
        `;
    }

    // 更新导航状态 - 优化为非阻塞并行动画
    static updateNavigation(pageName) {
        // 缓存导航项查询结果
        if (!this._cachedNavItems) {
            this._cachedNavItems = document.querySelectorAll('.nav-item');
        }
        
        // 使用requestAnimationFrame确保动画并行处理，不阻塞页面切换
        requestAnimationFrame(() => {
            this._cachedNavItems.forEach(item => {
                // 移除之前的动画类
                item.classList.remove('nav-entering', 'nav-exiting');

                if (item.dataset.page === pageName) {
                    // 如果之前未激活,添加进入动画
                    if (!item.classList.contains('active')) {
                        item.classList.add('nav-entering');
                        // 动画完成后清理动画类
                        setTimeout(() => item.classList.remove('nav-entering'), 120);
                    }
                    item.classList.add('active');
                } else {
                    // 如果之前已激活,添加退出动画
                    if (item.classList.contains('active')) {
                        item.classList.add('nav-exiting');
                        // 动画完成后清理动画类
                        setTimeout(() => item.classList.remove('nav-exiting'), 100);
                    }
                    item.classList.remove('active');
                }
            });
        });
    }

    // 清理缓存的DOM引用
    static clearDOMCache() {
        this._cachedNavItems = null;
    }

    static updateLayout() {
        LayoutManager.updateLayout();
    }

    static updateHeaderTransparency() {
        const header = this.elements.header;
        const mainContent = this.elements.mainContent;
        const nav = document.querySelector('.app-nav');
        if (!header || !mainContent || !nav) return;

        const isLandscape = window.innerWidth >= 768;
        const scrollTop = mainContent.scrollTop;
        const headerHeight = header.offsetHeight;
        const contentHeight = mainContent.scrollHeight;
        const viewportHeight = mainContent.clientHeight;

        // 跟踪上次滚动位置
        if (!this.lastScrollPosition) {
            this.lastScrollPosition = scrollTop;
        }

        // 计算滚动方向 (1=向下, -1=向上)
        const scrollDirection = scrollTop > this.lastScrollPosition ? 1 : -1;
        this.lastScrollPosition = scrollTop;

        // 当滚动超过顶栏高度时显示背景
        if (scrollTop > headerHeight) {
            header.classList.add('header-solid');

            // 竖屏模式下根据滚动方向显示/隐藏底栏
            if (!isLandscape) {
                // 向下滚动时显示底栏
                if (scrollDirection === -1) {
                    nav.classList.remove('hidden');
                    nav.classList.add('visible');
                }
                // 向上滚动时隐藏底栏
                else if (scrollDirection === 1 && scrollTop > headerHeight * 1.5) {
                    nav.classList.remove('visible');
                    nav.classList.add('hidden');
                }
            }
        } else {
            header.classList.remove('header-solid');
            // 顶部区域总是显示底栏
            nav.classList.remove('hidden');
            nav.classList.add('visible');
        }
    }
}
// 初始化应用
const app = new App();

// 绑定事件监听器
window.addEventListener('DOMContentLoaded', () => {
    // 绑定主题切换按钮点击事件
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (window.app?.toggleTheme) {
                window.app.toggleTheme();
            }
        });
    }

    // 绑定语言切换按钮点击事件
    const languageButton = document.getElementById('language-button');
    if (languageButton) {
        languageButton.addEventListener('click', () => {
            const languageSelector = document.querySelector('.language-selector');
            if (languageSelector) {
                UI.showOverlay(languageSelector);
            }
        });
    }

    // 绑定取消语言选择按钮点击事件
    const cancelLanguage = document.getElementById('cancel-language');
    if (cancelLanguage) {
        cancelLanguage.addEventListener('click', () => {
            const languageSelector = document.querySelector('.language-selector');
            if (languageSelector) {
                UI.hideOverlay(languageSelector);
            }
        });
    }
    
    // 添加滚动监听
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.addEventListener('scroll', () => {
            UI.updateHeaderTransparency();
        });
    }

    // 初始化顶栏状态
    UI.updateHeaderTransparency();

    // 布局事件由LayoutManager统一管理

    // 绑定历史记录变化事件
    window.addEventListener('popstate', () => {
        const pageName = Router.getCurrentPage();
        Router.navigate(pageName, false);
    });

    // 布局已由LayoutManager统一管理

    // 初始化应用
    app.init().catch(error => {
        console.error('应用初始化失败:', error);
        UI.showError('应用初始化失败', error.message);
    });
});

// 导出全局API
window.app = {
    init: () => app.init(),
    execCommand: (command) => app.execCommand(command),
    loadPage: (pageName) => Router.navigate(pageName),
    o: (command) => app.execCommand(command),
    
    // 添加新页面注册API
    registerPage: (pageConfig) => {
        if (!app.state.pagesConfig) return false;
        
        // 检查参数完整性
        if (!pageConfig.id || !pageConfig.name || !pageConfig.module || !pageConfig.file) {
            console.error('注册页面失败: 配置不完整', pageConfig);
            return false;
        }
        
        // 添加到配置
        app.state.pagesConfig.pages.push(pageConfig);
        
        // 更新Router模块映射
        Router.initModules(app.state.pagesConfig);
        
        // 若底栏已加载，需要更新导航
        app.initNavigation();
        
        // 加载页面模块JS
        const script = document.createElement('script');
        script.src = pageConfig.file;
        document.body.appendChild(script);
        
        return true;
    }
};
