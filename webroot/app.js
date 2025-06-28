export class App {
    constructor() {
        this.state = { isLoading: true, currentPage: null, theme: 'light', config: null };
        this.cache = new Map();
        this.preloadCache = new Map();
        this.initTheme();
    }

    initTheme() {
        const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        this.setTheme(dark ? 'dark' : 'light');
        window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', e => this.setTheme(e.matches ? 'dark' : 'light'));
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.state.theme = theme;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
        this.updateThemeIcon();
    }

    updateThemeIcon() {
        const btn = document.getElementById('theme-toggle');
        if (btn) {
            btn.querySelector('.material-symbols-rounded').textContent = this.state.theme === 'dark' ? 'dark_mode' : 'light_mode';
            btn.title = I18n?.translate?.('THEME', '主题') || '主题';
        }
    }

    async init(pageModules = null) {
        try {
            const [config] = await Promise.all([
                this.loadConfig(pageModules),
                I18n?.init?.() || Promise.resolve(),
                this.preloadCriticalAssets()
            ]);
            
            this.state.config = config;
            Router.init(config, pageModules);
            UI.init();
            this.initSystemButtons();
            
            const initialPage = Router.getCurrentPage();
            await Promise.all([
                Router.navigate(initialPage, false, true),
                this.preloadOtherPages(initialPage)
            ]);
            
            this.finishLoading();
        } catch (error) {
            console.error('App init failed:', error);
            this.showError(error);
        }
    }

    async loadConfig(pageModules = null) {
        // 从传入的页面模块中获取配置
        const pages = [];
        
        if (pageModules) {
            Object.values(pageModules).forEach(module => {
                if (module && module.config) {
                    pages.push(module.config);
                }
            });
        }
        
        return {
            pages: pages.length > 0 ? pages : this.getDefaultConfig().pages,
            defaultPage: 'status'
        };
    }

    getDefaultConfig() {
        return {
            pages: [{ id: "status", name: "状态", icon: "dashboard", module: "StatusPage" }],
            defaultPage: "status"
        };
    }

    async preloadCriticalAssets() {
        const links = ['css/md3.css', 'css/components.css', 'css/style.css'].map(href => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            document.head.appendChild(link);
            return new Promise(resolve => {
                link.onload = link.onerror = resolve;
            });
        });
        await Promise.allSettled(links);
    }

    async preloadOtherPages(currentPage) {
        if (!this.state.config?.pages) return;
        const others = this.state.config.pages.filter(p => p.id !== currentPage);
        requestIdleCallback(() => {
            others.forEach(page => this.preloadPage(page));
        }, { timeout: 1000 });
    }

    async preloadPage(page) {
        if (this.preloadCache.has(page.id)) return;
        try {
            const module = Router.pageModules[page.module];
            if (module?.prerender) {
                const html = await module.prerender();
                this.preloadCache.set(page.id, html);
            }
        } catch (e) {
            console.warn(`Preload failed: ${page.id}`, e);
        }
    }

    initSystemButtons() {
        const container = document.getElementById('system-buttons');
        if (!container) return;
        container.innerHTML = `
            <button id="language-button" class="icon-button" title="${I18n?.translate?.('LANGUAGE', '语言') || '语言'}">
                <span class="material-symbols-rounded">translate</span>
            </button>
            <button id="theme-toggle" class="icon-button" title="${I18n?.translate?.('THEME', '主题') || '主题'}">
                <span class="material-symbols-rounded">${this.state.theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
            </button>`;
        
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark'));
        document.getElementById('language-button')?.addEventListener('click', () => this.showLanguageSelector());
    }

    showLanguageSelector() {
        const selector = document.getElementById('language-selector');
        if (selector) UI.showOverlay(selector);
    }

    finishLoading() {
        document.body.classList.add('app-loaded');
        this.state.isLoading = false;
    }

    showError(error) {
        const main = document.getElementById('main-content');
        if (main) {
            main.innerHTML = `<div class="error-container"><h2>启动失败</h2><p>${error.message}</p><button onclick="location.reload()">重新加载</button></div>`;
        }
    }
}

export class Router {
    static modules = {};
    static pageModules = {};
    static cache = new Map();
    static loading = new Map();

    static init(config, pageModules = {}) {
        if (!config?.pages) return;
        config.pages.forEach(page => this.modules[page.id] = page.module);
        this.pageModules = pageModules;
        window.addEventListener('popstate', () => this.navigate(this.getCurrentPage(), false));
    }

    static getCurrentPage() {
        const hash = location.hash.slice(1);
        return this.modules[hash] ? hash : (app.state.config?.defaultPage || 'status');
    }

    static async navigate(pageName, updateHistory = true, isInitial = false) {
        try {
            if (app.state.currentPage === pageName && !isInitial) return;
            
            const [module] = await Promise.all([
                this.loadModule(pageName),
                this.deactivateCurrent()
            ]);
            
            app.state.currentPage = pageName;
            UI.updateNav(pageName);
            
            if (updateHistory) history.pushState(null, '', `#${pageName}`);
            
            await this.renderPage(module, pageName);
            await this.activatePage(module, pageName);
            
        } catch (error) {
            console.error('Navigation failed:', error);
            UI.showError('页面加载失败', error.message);
        }
    }

    static async loadModule(pageName) {
        if (this.cache.has(pageName)) return this.cache.get(pageName);
        if (this.loading.has(pageName)) return await this.loading.get(pageName);
        
        const promise = this.loadModuleInternal(pageName);
        this.loading.set(pageName, promise);
        
        try {
            const module = await promise;
            this.loading.delete(pageName);
            return module;
        } catch (error) {
            this.loading.delete(pageName);
            throw error;
        }
    }

    static async loadModuleInternal(pageName) {
        const moduleName = this.modules[pageName];
        const module = this.pageModules[moduleName];
        if (!module) throw new Error(`Module not found: ${pageName}`);
        
        if (!module._initialized && module.init) {
            const result = await module.init();
            if (result === false) throw new Error(`Init failed: ${pageName}`);
            module._initialized = true;
        }
        
        this.cache.set(pageName, module);
        return module;
    }

    static async deactivateCurrent() {
        if (!app.state.currentPage) return;
        const current = this.cache.get(app.state.currentPage) || this.pageModules[this.modules[app.state.currentPage]];
        if (current?.onDeactivate) {
            try { await current.onDeactivate(); } catch (e) { console.warn('Deactivate failed:', e); }
        }
    }

    static async renderPage(module, pageName) {
        const main = document.getElementById('main-content');
        if (!main) return;
        
        const old = main.querySelector('.page-container');
        if (old) old.remove();
        
        const container = document.createElement('div');
        container.className = 'page-container';
        
        const preloaded = app.preloadCache.get(pageName);
        container.innerHTML = preloaded || module.render();
        
        main.appendChild(container);
        requestAnimationFrame(() => container.classList.add('slide-in'));
    }

    static async activatePage(module, pageName) {
        if (module.afterRender) {
            try { await module.afterRender(); } catch (e) { console.warn('AfterRender failed:', e); }
        }
        if (module.onActivate) {
            try { await module.onActivate(); } catch (e) { console.warn('Activate failed:', e); }
        }
        
        requestAnimationFrame(() => {
            UI.updatePageTitle(pageName);
            UI.updatePageActions(pageName);
        });
    }
}

export class UI {
    static elements = {};
    static pageActions = new Map();
    static activeActions = new Set();

    static init() {
        this.updateElements();
        this.initNav();
        this.initLanguage();
    }

    static updateElements() {
        this.elements = {
            app: document.getElementById('app'),
            header: document.querySelector('.app-header'),
            main: document.getElementById('main-content'),
            title: document.getElementById('page-title'),
            actions: document.getElementById('page-actions'),
            nav: document.getElementById('app-nav')
        };
    }

    static async initNav() {
        if (!app.state.config?.pages || !this.elements.nav) return;
        
        const nav = document.createElement('div');
        nav.className = 'nav-content';
        
        const list = document.createElement('ul');
        app.state.config.pages.forEach(page => {
            const item = document.createElement('div');
            item.className = 'nav-item';
            item.dataset.page = page.id;
            item.innerHTML = `<span class="material-symbols-rounded">${page.icon}</span><span class="nav-label" data-i18n="${page.i18n_key}">${page.name}</span>`;
            item.addEventListener('click', () => Router.navigate(page.id));
            list.appendChild(item);
        });
        
        nav.appendChild(list);
        this.elements.nav.appendChild(nav);
    }

    static updateNav(pageName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });
    }

    static updatePageTitle(pageName) {
        if (!app.state.config?.pages || !this.elements.title) return;
        const page = app.state.config.pages.find(p => p.id === pageName);
        if (page) {
            const title = page.i18n_key ? I18n.translate(page.i18n_key, page.name) : page.name;
            this.elements.title.textContent = title || 'AMMF WebUI';
        }
    }

    static registerPageActions(pageName, actions) {
        const valid = actions.filter(a => a.id && a.icon);
        this.pageActions.set(pageName, valid);
        if (app.state.currentPage === pageName) this.updatePageActions(pageName);
    }

    static updatePageActions(pageName) {
        if (!this.elements.actions) return;
        
        this.activeActions.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.replaceWith(btn.cloneNode(true));
        });
        this.activeActions.clear();
        
        const actions = this.pageActions.get(pageName) || [];
        this.elements.actions.innerHTML = actions.map(a => 
            `<button id="${a.id}" class="icon-button" title="${a.title}"><span class="material-symbols-rounded">${a.icon}</span></button>`
        ).join('');
        
        actions.forEach(action => {
            const btn = document.getElementById(action.id);
            if (btn && action.onClick) {
                this.activeActions.add(action.id);
                btn.addEventListener('click', () => {
                    const module = Router.pageModules[Router.modules[pageName]];
                    if (module?.[action.onClick]) module[action.onClick]();
                });
            }
        });
    }

    static clearPageActions(pageName) {
        if (!this.elements.actions) return;
        this.activeActions.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.replaceWith(btn.cloneNode(true));
        });
        this.activeActions.clear();
        this.elements.actions.innerHTML = '';
        if (pageName) this.pageActions.delete(pageName);
    }

    static initLanguage() {
        const btn = document.getElementById('language-button');
        const selector = document.getElementById('language-selector');
        
        if (btn && selector) {
            btn.addEventListener('click', () => this.showOverlay(selector));
            selector.addEventListener('click', e => { if (e.target === selector) this.hideOverlay(selector); });
            document.getElementById('cancel-language')?.addEventListener('click', () => this.hideOverlay(selector));
            this.updateLanguageOptions();
        }
    }

    static updateLanguageOptions() {
        const container = document.getElementById('language-options');
        if (!container || !window.I18n) return;
        
        container.innerHTML = I18n.supportedLangs.map(lang => 
            `<div class="language-option ${lang === I18n.currentLang ? 'selected' : ''}" data-lang="${lang}">
                <input type="radio" name="language" id="lang-${lang}" value="${lang}" ${lang === I18n.currentLang ? 'checked' : ''} class="radio">
                <label for="lang-${lang}">${this.getLanguageName(lang)}</label>
            </div>`
        ).join('');
        
        container.addEventListener('click', async e => {
            const option = e.target.closest('.language-option');
            if (option) {
                const lang = option.dataset.lang;
                if (lang !== I18n.currentLang) {
                    this.hideOverlay(document.getElementById('language-selector'));
                    await I18n.setLanguage(lang);
                }
            }
        });
    }

    static getLanguageName(lang) {
        return { 'zh': '中文', 'en': 'English', 'ru': 'Русский' }[lang] || lang.toUpperCase();
    }

    static showOverlay(element) {
        if (element) element.classList.add('active');
    }

    static hideOverlay(element) {
        if (!element || element.classList.contains('closing')) return;
        element.classList.add('closing');
        setTimeout(() => element.classList.remove('active', 'closing'), 200);
    }

    static showError(title, message) {
        if (this.elements.main) {
            this.elements.main.innerHTML = `<div class="page-container"><div class="error-container"><h2>${title}</h2><p>${message}</p></div></div>`;
        }
    }
}

// ES模块导出
export const app = new App();

// 为兼容性保留全局导出
if (typeof window !== 'undefined') {
    window.App = App;
    window.Router = Router;
    window.UI = UI;
    window.app = app;
}

// 初始化逻辑移到主模块中