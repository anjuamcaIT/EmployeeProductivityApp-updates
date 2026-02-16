 
const signalR = require("@microsoft/signalr");
const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require('fs');
const os = require('os'); 
const { RootURL } = require('./apiClient');  
//const authFile = path.join(__dirname, '../config/auth.json');
const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'JolahaApp'); 
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
} 
const authFile = path.join(appDataPath, 'auth.json');
let connection = null; 
 

async function startSignalR(getTokenFunc) {
    debugger
    if (connection) return connection;

    connection = new signalR.HubConnectionBuilder()
    .withUrl(`${RootURL}/notificationHub`, {
        accessTokenFactory: async () => {
            const token = await getTokenFunc();
             console.log("SignalR Token:", token);
            if (!token) {
                console.error("SignalR: No valid token available!");
                throw new Error("No valid token for SignalR");
            }
            return token;
        }
    })
    .withAutomaticReconnect()
    .build();

    // connection.on("ReceiveNotification", (data) => {
    //     console.log("Notification:", data);
    //     showApprovalPopup(data);
    // });
    connection.on("ReceiveNotification", (data) => {
        debugger
        if (!fs.existsSync(authFile)) return; 
        const auth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
        if (!auth.isLoggedIn || data.userId !== auth.user.id) return;
            console.log("Notification:", data);
            showApprovalPopup(data);
        });

    try {
        debugger
        await connection.start();
        console.log("SignalR connected ✅");
    } catch (err) {
        console.error("SignalR failed to start:", err);
        connection = null;
        setTimeout(() => startSignalR(getTokenFunc), 5000); // retry
    }

    return connection;
} 

async function stopSignalR() {
    if (connection) {
        try {
            await connection.stop();
            console.log("SignalR stopped ✅");
        } catch (err) {
            console.error("Error stopping SignalR:", err);
        }
        connection = null;
    }
}


// function showApprovalPopup(data) {
//     const { screen , BrowserWindow} = require('electron');
//     const display = screen.getPrimaryDisplay();
//     const { width: screenWidth, height: screenHeight } = display.workAreaSize;

//     // Set popup height (small rectangle like Teams popup)
//     const popupHeight = 120; // px, adjust as needed
    

//     const popup = new BrowserWindow({
//     width: 320,
//     height: popupHeight, // must be pixels
//     x: screenWidth - 360 - 20,
//     y: screenHeight - 120 - 20,
//     frame: false,
//     alwaysOnTop: true,
//     skipTaskbar: true,
//     resizable: false,
//     transparent: true,    
//     focusable: false,
//     hasShadow: true,      
//     webPreferences: {
//         nodeIntegration: true,
//         contextIsolation: false
//     }
// });


//     popup.loadFile(path.join(__dirname, "../ui/approval-popup.html"));

//     popup.webContents.once("did-finish-load", () => {
//         popup.webContents.send("approval-data", data);
//     });

//     setTimeout(() => {
//         if (!popup.isDestroyed()) popup.close();
//     }, 15000);
// }

 

function showApprovalPopup(data) {
    const display = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = display.workAreaSize;

    const popupHeight = 160;  
    const popupWidth = 400;  

    const popup = new BrowserWindow({
        width: popupWidth,
        height: popupHeight,
        x: screenWidth - popupWidth - 20,
        y: screenHeight,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        transparent: true,
        focusable: false,
        hasShadow: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    popup.loadFile(path.join(__dirname, "../ui/approval-popup.html"));

        popup.webContents.on('did-finish-load', () => {
        popup.webContents.send('approval-data', data);

        // Slide-in animation: move window up
        let targetY = screenHeight - popupHeight - 20;
        let currentY = screenHeight;
        const interval = setInterval(() => {
            currentY -= 10; // slide speed
            if (currentY <= targetY) {
                currentY = targetY;
                clearInterval(interval);
            }
            popup.setBounds({ x: screenWidth - popupWidth - 20, y: currentY, width: popupWidth, height: popupHeight });
        }, 10);
    });
    //  setTimeout(() => {
    //       if (!popup.isDestroyed()) popup.close();
    //   }, 15000);
}

 
ipcMain.on("approval-response", (event, response) => {
    console.log("User response:", response);

    // Send response back to backend via SignalR
    if (connection) {
        connection.invoke("RespondToLogin", response)
            .catch(err => console.error(err));
    }
});

module.exports = { startSignalR , stopSignalR, connection };
