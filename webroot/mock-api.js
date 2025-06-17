/**
 * 模拟API功能
 * 用于在GitHub Pages环境中模拟core.js中的功能
 */

// 检测是否在GitHub Pages环境中运行
const isGitHubPages = window.location.hostname.includes('github.io');

// 如果在GitHub Pages环境中，替换原始的Core对象
if (isGitHubPages && window.Core) {
  console.log('Running in GitHub Pages environment, using mock API');
  
  // 保存原始Core对象的引用
  const OriginalCore = { ...window.Core };
  
  // 模拟execCommand函数
  window.Core.execCommand = async function(command) {
    console.log('Mock execCommand:', command);
    
    // 模拟不同命令的响应
    if (command.includes('ls') || command.includes('dir')) {
      return 'file1\nfile2\nfile3';
    } else if (command.includes('cat') || command.includes('type')) {
      return 'Mock file content';
    } else {
      return 'Command executed successfully (mock)';
    }
  };
  
  // 添加模拟状态标识
  window.Core.isMockAPI = true;
  
  // 显示模拟环境通知
  setTimeout(() => {
    if (window.Core.showToast) {
      window.Core.showToast('Running in demo mode with mock API', 'info', 5000);
    }
  }, 1000);
}