# AMMF WebUI

这是AMMF模块的Web用户界面，提供了一个友好的图形界面来管理和控制AMMF模块。

## 功能特点

- 响应式设计，适配各种设备
- 多语言支持（中文、英文、俄文）
- 深色/浅色主题切换
- 模块状态监控
- 设置管理

## GitHub Pages 部署

本项目配置了自动部署到GitHub Pages的工作流。当你推送代码到main或master分支时，GitHub Actions会自动将WebUI部署到GitHub Pages。

### 模拟API功能

在GitHub Pages环境中，由于安全限制，无法执行真实的Shell命令。为了解决这个问题，我们添加了模拟API功能：

- `mock-api.js`文件会在GitHub Pages环境中自动模拟`core.js`中的API功能
- 模拟的API会返回预设的响应，使界面可以正常展示
- 页面加载时会显示一个提示，表明当前运行在演示模式下

### 手动触发部署

你也可以在GitHub仓库页面的Actions标签页中手动触发部署工作流：

1. 进入仓库的Actions标签页
2. 选择"Deploy to GitHub Pages"工作流
3. 点击"Run workflow"按钮
4. 选择要部署的分支，然后点击"Run workflow"

## 本地开发

### 文件结构

```
webroot/
├── app.js          # 主应用逻辑
├── core.js         # 核心API功能
├── mock-api.js     # 模拟API功能（GitHub Pages环境使用）
├── i18n.js         # 国际化支持
├── theme.js        # 主题管理
├── index.html      # 主HTML文件
├── css/            # 样式文件
├── pages/          # 页面组件
└── translations/   # 翻译文件
```

### 测试模拟API

在本地开发环境中，你可以通过以下方式测试模拟API功能：

1. 在浏览器控制台中执行：`window.location.hostname = 'username.github.io'`
2. 刷新页面，模拟API将被激活
3. 你会看到一个提示，表明当前运行在演示模式下

## 贡献

欢迎提交Pull Request或Issue来改进这个项目！