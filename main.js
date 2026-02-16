const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto'); 
const gotTheLock = app.requestSingleInstanceLock();
const signalr = require("./services/signalrService");
const { fetchOTP, onUpdate } = require('./trackers/OTP');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

let userToken = null;
let tokenExpiryTime = null;
let auth = { isLoggedIn: false, user: {}, token: null }; 
let tray = null;
let wasOffline = false;
let mainWindow;
let api, initScreenshotManager , checkInternet, stopScreenshotManager;
let startHeartbeat, stopHeartbeat;
let startActivityTracker, stopActivityTracker, getHourlyReport;

const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'JolahaApp'); 
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
} 
const authFile = path.join(appDataPath, 'auth.json');

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}  

// ===== App Starts =====
app.whenReady().then(async () => { 
    await loadAuth();
    createWindow(); 
    autoUpdater.checkForUpdatesAndNotify();
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });  
    tray = new Tray(path.join(__dirname, 'assets/icon.ico'));
    tray.setToolTip('Jolaha App');   
    buildTrayMenu(auth.isLoggedIn); 
    if (auth.isLoggedIn) {
        loadDashboard(auth.user); 
    } else {
        mainWindow.loadFile('ui/login.html');
    } 
    setTimeout(() => backgroundStartup(auth), 2000); 
    setupAutoLaunch();
});

// async function loadAuth() {
//     try {
//         if (fs.existsSync(authFile)) {
//             auth = JSON.parse(await fs.promises.readFile(authFile, 'utf-8'));
//         }
//     } catch (err) {
//         console.error("Error loading User:", err);
//         auth = { isLoggedIn: false, user: {}, token: null };
//     }
// }

async function loadAuth() {
    try {
        if (fs.existsSync(authFile)) {
            auth = JSON.parse(await fs.promises.readFile(authFile, 'utf-8'));

            if (auth.token) {
                try {
                    const jwtPayload = JSON.parse(Buffer.from(auth.token.split(".")[1], "base64").toString());
                    tokenExpiryTime = jwtPayload.exp * 1000; // convert to ms
                    userToken = auth.token;
                    console.log("Token loaded from authFile, expires at:", new Date(tokenExpiryTime));
                } catch (err) {
                    console.warn("Failed to decode token from authFile", err);
                    tokenExpiryTime = null;
                    userToken = null;
                }
            }
        }
    } catch (err) {
        console.error("Error loading auth file:", err);
        auth = { isLoggedIn: false, user: {}, token: null };
    }
}



// ===== CREATE WINDOW =====
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: false,
        maximizable: false,
        minimizable: true,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    }); 
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);  
    mainWindow.on('close', (e) => {
        if (!app.isQuiting) {
            e.preventDefault();
            mainWindow.hide();
        }
    }); 
}

// ===== TRAY MENU BUILDER =====
function buildTrayMenu(isLoggedIn) {
    if (!tray) return;
    let template;
    if (isLoggedIn) {
        template = [
            {
                label: 'Show App',
                click: () => {
                    mainWindow.loadFile(path.join(__dirname, 'ui/OTP.html'));
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            {
                label: 'Productivity',
                click: () => {
                    mainWindow.loadFile(path.join(__dirname, 'ui/DashBoard.html'));
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            {
                label: 'Verification Code',
                click: () => {
                    mainWindow.loadFile(path.join(__dirname, 'ui/OTP.html'));
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: async () => { 
                    let auth = { isLoggedIn: false };
                    if (fs.existsSync(authFile)) {
                        auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
                    }
                    if (auth.isLoggedIn) {
                        if (mainWindow && mainWindow.webContents) {
                            mainWindow.webContents.send('request-quit');
                        }
                    } else {
                        app.isQuiting = true;
                        app.quit();
                    }
                }
            }
        ];
    } else {
        template = [
            {
                label: 'Show App',
                click: () => {
                    mainWindow.show();
                    mainWindow.focus();
                }
            },
            { type: 'separator' },
            { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
        ];
    }
    tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ===== Load DashBoard =====
function loadDashboard(employee) {
    mainWindow.loadFile('ui/OTP.html');
    //startTracking(employee);
}

// ===== AUTO LAUNCH =====
function setupAutoLaunch() {
    if (process.platform === "win32") {
        app.setLoginItemSettings({
            openAtLogin: true,
            path: process.execPath,
            args: ['--startup']
        });
        console.log('Auto-launch enabled for Windows');
    }
}

// ===== Background Tasks =====
async function backgroundStartup(auth) {
    try { 
        debugger
        console.log("Starting background services...");  
        setTimeout(monitorInternet, 5000); 
        if (!auth.isLoggedIn) return; 
        userToken = auth.token; 
        const token = await getValidToken();
        if (!token) {
            console.warn("Token invalid. Redirecting to login.");
            mainWindow.loadFile('ui/login.html');
            return;
        } 
         startAllBackgroundServices(auth.user); 
        //signalr.startSignalR(getValidToken); 
        signalr.startSignalR(getValidToken);
        console.log("Background services started");

    } catch (err) {
        console.error("Background startup error:", err);
    }
}

function startAllBackgroundServices(employee) {
    loadServices(); 
    loadTrackers();
    startActivityTracker(employee);
    initScreenshotManager(employee);
    startHeartbeat(employee);
}


function loadServices() {
    if (!api) api = require('./services/apiClient');
    if (!checkInternet) checkInternet = require('./services/internetCheck');
} 

async function getValidToken() { 
    debugger
     console.log("Token Eapiry...",tokenExpiryTime); 
    if (!userToken || (tokenExpiryTime && Date.now() > tokenExpiryTime)) {
        console.log("Token expired or missing, performing silent login..."); 
        const authData = fs.existsSync(authFile)  
    ? JSON.parse(await fs.promises.readFile(authFile, 'utf-8')) 
    : null;
        if (!authData || !authData.isLoggedIn) {
            console.log("No stored credentials, cannot refresh token");
            return null;
        } 
        console.log("Credential",authData); 
        try {
            const response = await api.post("/Auth/login", {
                UserId: authData.user.id,
                Password: authData.user.password || "",
                SecurityKey: authData.user.authSecuritykey,
                HostName: os.hostname(),
                MacAddress: getMacAddress(),
                DeviceId: generateDeviceId(),
                OS: getOSInfo(),
                RegisteredDateTime: new Date().toISOString(),
                RegisterdTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });

            if (response.data.success) {
                userToken = response.data.token; 
                const jwtPayload = JSON.parse(Buffer.from(userToken.split(".")[1], "base64").toString());
                tokenExpiryTime = jwtPayload.exp * 1000; 
                console.log("Silent login success, token refreshed"); 
                authData.token = userToken;
                fs.writeFileSync(authFile, JSON.stringify(authData));
            } else {
                console.warn("Silent login failed, forcing logout");
                userToken = null;
                tokenExpiryTime = null;
                mainWindow.webContents.send("force-logout");
            }
        } catch (err) {
            console.error("Silent login error:", err);
            userToken = null;
            tokenExpiryTime = null;
            mainWindow.webContents.send("force-logout");
        }
    }
    return userToken;
} 

function loadTrackers() {
    if (!startActivityTracker) {
        const trackers = require('./trackers/activityTracker');
        startActivityTracker = trackers.startActivityTracker;
        stopActivityTracker = trackers.stopActivityTracker;
        getHourlyReport = trackers.getHourlyReport;
    }
    if (!initScreenshotManager) {
        const screenshot = require('./trackers/screenshot');
        initScreenshotManager = screenshot.init;
        stopScreenshotManager = screenshot.stop;
    }
    if (!fetchOTP) {
        ({ fetchOTP } = require('./trackers/OTP'));
    }
    if (!startHeartbeat) {
        ({ startHeartbeat, stopHeartbeat } = require('./trackers/heartbeat'));
    }
}


 
// ===== DEVICE INFO HELPERS =====
function getMacAddress() {
    const nics = os.networkInterfaces();
    for (const iface of Object.values(nics)) {
        for (const nic of iface) {
            if (!nic.internal && nic.mac && nic.mac !== '00:00:00:00:00:00') {
                return nic.mac;
            }
        }
    }
    return null;
}

function getOSInfo() {
    return os.type() + ' ' + os.arch();
}

function generateDeviceId() {
    const mac = getMacAddress() || '';
    const osInfo = getOSInfo();
    return crypto.createHash('sha256').update(mac + osInfo).digest('hex');
}  


// ===== INTERNET MONITOR =====
async function monitorInternet() {
    try {
        const online = await checkInternet();
        if (online && (wasOffline === true || wasOffline === null)) {
            console.log('Internet is back!');
            wasOffline = false;
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('internet-restored');
            }
        } else if (!online && (wasOffline === false || wasOffline === null)) {
            console.log('Offline...');
            wasOffline = true;
        }
    } catch (err) {
        console.error('Internet monitor error:', err);
    }
    setTimeout(monitorInternet, 5000);
} 

// ===== IPC HANDLERS =====
ipcMain.handle('login-api', async (event, loginData) => {
    loadServices();
    try {
        const response = await api.post('/Auth/login', loginData);
        return response.data || { success: false, message: 'Invalid Credentials' };
    } catch (err) {
        console.error('Login error in main process:', err.message || err);
        return { success: false, message: 'Login error: ' + (err.message || err) };
    }
}); 

// Validate Security Key
ipcMain.handle('validate-security-key', async (event, data) => {
    loadServices();
    try {
        const hostName = os.hostname();
        const macAddress = getMacAddress();
        const deviceId = generateDeviceId();
        const osName = getOSInfo();

        const response = await api.post('/UserActivity/validateSecurityKey', null, {
            params: {
                empId: data.empId,
                SecurityKey: data.securityKey,
                HostName: hostName,
                MacAddress: macAddress,
                DeviceID: deviceId,
                OsName: osName,
            }
        });
        return response.data;
    } catch (err) {
        console.error('Error validating security key:', err.message || err);
        return { isValid: false, message: 'Server error' };
    }
});

// Clear user auth / logout
ipcMain.handle('clear-auth', async () => {
    loadServices();
    try {
        if (stopScreenshotManager) stopScreenshotManager();
        if (stopHeartbeat) stopHeartbeat();
        if (stopActivityTracker) stopActivityTracker();

        await signalr.stopSignalR();

        //const authPath = path.join(__dirname, 'config/auth.json');
        if (fs.existsSync(authFile)) {
            fs.writeFileSync(authFile, JSON.stringify({ isLoggedIn: false, user: {} }));
        }

        buildTrayMenu(false);
        return { success: true };
    } catch (err) {
        console.error('Error clearing auth.json:', err);
        return { success: false, message: err.message };
    }
});

// Load user menu HTML
ipcMain.handle('load-user-menu', async (event, containerId) => {
    loadServices();
    try {
        const menuPath = path.join(__dirname, 'ui/userMenu.html');
        const html = await fs.promises.readFile(menuPath, 'utf-8');
        return html;
    } catch (err) {
        console.error('Failed to load user menu:', err);
        throw err;
    }
});

// Stop activity tracker
ipcMain.handle('stop-activity-tracker', async () => {
    try {
        stopActivityTracker();
        return { success: true };
    } catch (err) {
        console.error('Error stopping activity tracker:', err);
        return { success: false, message: err.message };
    }
});

// Get auth info
ipcMain.handle('get-auth', async () => {
    //const authPath = path.join(__dirname, 'config/auth.json');
    const data = fs.readFileSync(authFile, 'utf8');
    return JSON.parse(data);
});

// Login success
ipcMain.on('login-success', (event, data) => {
    const employee = data.employeeDetails;
    userToken = data.token; 
    fs.writeFileSync(authFile, JSON.stringify({ isLoggedIn: true, user: employee, token: data.token })); 
    loadDashboard(employee);
    //initScreenshotManager(employee);
    //startHeartbeat(employee);
    startAllBackgroundServices(employee);
    signalr.startSignalR(getValidToken);
    //startActivityTracker(employee);
    buildTrayMenu(true); 
    setInterval(async () => {
        if (!userToken) return;
        const token = await getValidToken();
        if (token !== userToken) {
            console.log("Token updated, restarting SignalR...");
            if (signalr.connection) {
                signalr.connection.stop().then(() => {
                    signalr.connection = null;
                    signalr.startSignalR(getValidToken);
                });
            }
        }
    }, 10 * 60 * 1000); // every 10 minutes
});

// Get hourly stats
ipcMain.handle('get-hourly-stats', () => {
    return getHourlyReport();
});

// Get OTP
ipcMain.handle('get-otp', async () => {
    try {
        const authData = fs.existsSync(authFile) ? JSON.parse(fs.readFileSync(authFile, 'utf-8')) : { isLoggedIn: false, user: {} };
        if (!authData.isLoggedIn || !authData.user?.id) {
            return { OTPCode: '', OTPSecs: 0 };
        }

        const data = await fetchOTP(authData.user.id);
        return data;
    } catch (err) {
        console.error('Error fetching OTP:', err);
        return { OTPCode: '', OTPSecs: 0 };
    }
});

// Show notification
ipcMain.on("show-notification", (event, data) => {
    const notification = new Notification({ title: data.title, body: data.message });
    notification.show();

    notification.on("click", () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.show();
            win.focus();
            win.webContents.send("notification-clicked");
        }
    });
});

// Get device info
ipcMain.handle('get-device-info', () => {
    return {
        mac: getMacAddress(),
        os: getOSInfo(),
        deviceId: generateDeviceId(),
        hostname: os.hostname(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        loginDateTime: new Date().toISOString()
    };
});

// Quit confirmed
ipcMain.on('quit-confirmed', () => {
    app.isQuiting = true;
    app.quit();
});  

autoUpdater.on("update-downloaded", () => {
  const { dialog } = require("electron");
  dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: "A new update is ready. Restart now?",
    buttons: ["Restart", "Later"]
  }).then(result => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

