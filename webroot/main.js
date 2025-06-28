/**
 * AMMF WebUI 主入口模块
 * 标准ES模块入口点
 */

import { Core } from './core.js';
import { I18n } from './i18n.js';
import { App, Router, UI, app } from './app.js';

// 动态导入页面模块
const loadPageModules = async () => {
    const modules = await Promise.all([
        import('./pages/status.js'),
        import('./pages/logs.js'),
        import('./pages/settings.js'),
        import('./pages/about.js')
    ]);
    
    return {
        StatusPage: modules[0].StatusPage,
        LogsPage: modules[1].LogsPage,
        SettingsPage: modules[2].SettingsPage,
        AboutPage: modules[3].AboutPage
    };
};

// 应用初始化
const initializeApp = async () => {
    try {
        // 动态加载页面模块
        const pageModules = await loadPageModules();
        
        // 初始化应用，传入页面模块
        await app.init(pageModules);
        
        console.log('AMMF WebUI 应用初始化完成');
    } catch (error) {
        console.error('应用初始化失败:', error);
        // 显示错误页面
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;font-family:system-ui;">
                <h2 style="color:#d32f2f;margin-bottom:1rem;">应用加载失败</h2>
                <p style="color:#666;margin-bottom:2rem;">${error.message}</p>
                <button onclick="location.reload()" style="padding:0.75rem 1.5rem;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;">重新加载</button>
            </div>
        `;
    }
};

// 启动应用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// 导出主要模块供其他模块使用
export { Core, I18n, App, Router, UI, app };