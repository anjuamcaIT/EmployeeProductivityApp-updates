 
const { contextBridge, ipcRenderer } = require('electron'); 


contextBridge.exposeInMainWorld('electronAPI', {
    loginWithAPI: async (loginData) => { 
        return ipcRenderer.invoke('login-api', loginData);
    }, 
    loginSuccess: (data) => ipcRenderer.send('login-success', data),
    getHourlyStats: () => ipcRenderer.invoke('get-hourly-stats'),
    getAuth: () => ipcRenderer.invoke('get-auth'),
    validateSecurityKey: (empId, securityKey) => 
        ipcRenderer.invoke('validate-security-key', { empId, securityKey }),
    clearAuth: () => ipcRenderer.invoke('clear-auth'),
    stopActivityTracking: () => ipcRenderer.invoke('stop-activity-tracker'),
    getDeviceInfo: async () => ipcRenderer.invoke('get-device-info'),
    getSystemTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    loadUserMenu: () => ipcRenderer.invoke('load-user-menu') ,
      OTP: {
        init: async () => { 
            return ipcRenderer.invoke('get-otp'); 
        },
        onUpdate: (callback) => {
            // Optional
        }
    },
    quitApp: () => ipcRenderer.send('quit-confirmed'),
    on: (channel, callback) => ipcRenderer.on(channel, (event, ...args) => callback(...args)),
    send: (channel, data) => ipcRenderer.send(channel, data) 
});

 
