/**
 * AMMF WebUI 核心功能模块
 * 提供Shell命令执行能力
 */

export const Core = {
    // 模块路径
    MODULE_PATH: '/data/adb/modules/AMMF/',

    // 执行Shell命令
    async execCommand(command) {
        const callbackName = `exec_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        return new Promise((resolve, reject) => {
            window[callbackName] = (errno, stdout, stderr) => {
                delete window[callbackName];
                errno === 0 ? resolve(stdout) : reject(stderr);
            };
            ksu.exec(command, "{}", callbackName);
        });
    },

    // 并行执行多个Shell命令
    async execCommandsParallel(commands) {
        if (!Array.isArray(commands)) {
            throw new Error('Commands must be an array');
        }
        
        const promises = commands.map(command => {
            if (typeof command === 'string') {
                return this.execCommand(command);
            } else if (command && typeof command.command === 'string') {
                // 支持带标识的命令对象 {id: 'identifier', command: 'shell command'}
                return this.execCommand(command.command).then(result => ({
                    id: command.id,
                    result: result
                })).catch(error => ({
                    id: command.id,
                    error: error
                }));
            } else {
                return Promise.reject(new Error('Invalid command format'));
            }
        });
        
        return Promise.allSettled(promises);
    },

    // 并行执行命令并返回结果映射
    async execCommandsParallelMap(commandMap) {
        if (typeof commandMap !== 'object' || commandMap === null) {
            throw new Error('Command map must be an object');
        }
        
        const commands = Object.entries(commandMap).map(([key, command]) => ({
            id: key,
            command: command
        }));
        
        const results = await this.execCommandsParallel(commands);
        const resultMap = {};
        
        results.forEach((result, index) => {
            const key = commands[index].id;
            if (result.status === 'fulfilled') {
                if (result.value.error) {
                    resultMap[key] = { error: result.value.error };
                } else {
                    resultMap[key] = { result: result.value.result };
                }
            } else {
                resultMap[key] = { error: result.reason };
            }
        });
        
        return resultMap;
    },
    /**
     * 显示Toast消息
     * @param {string} message - 要显示的消息文本
     * @param {string} type - 消息类型 ('info', 'success', 'warning', 'error')
     * @param {number} duration - 消息显示时长 (毫秒)
     */
    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.error('Toast container not found!');
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');

            setTimeout(() => {
                if (toast.parentElement === toastContainer) {
                    toastContainer.removeChild(toast);
                }
            }, 150);
        }, duration);
    },
};
