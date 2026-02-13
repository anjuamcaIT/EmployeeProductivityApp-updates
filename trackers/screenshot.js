// trackers/screenshot.js
const screenshot = require('screenshot-desktop');
const api = require('../services/apiclient'); // your API service

let currentUser = null;
let lastScreenshotTime = 0;
let configInterval = null;
let screenshotInterval = null;
let isInitialized = false;
let screenshotConfig = {
    enabled: false,
    intervalMinutes: 0
};
 

function init(user) { 
    if (isInitialized) return;  
    currentUser = user;
    isInitialized = true; 
    fetchScreenshotConfig(); 
    configInterval = setInterval(fetchScreenshotConfig, 5 * 60 * 1000);
    screenshotInterval = setInterval(checkAndTakeScreenshot, 60 * 1000);
}


// ------------------- Fetch settings from API -------------------
async function fetchScreenshotConfig() {
    if (!currentUser) return;

    try {
        const response = await api.get(`/UserActivity/GetScreenshotSettings?EmpId=${encodeURIComponent(currentUser.id)}`); 
        const data = response.data; 
        screenshotConfig = {
            enabled: data.enabled,
            intervalMinutes: data.intervalMinutes
        }; 
        console.log('Screenshot settings updated:', screenshotConfig);
    } catch (err) {
        console.error('Error fetching screenshot settings:', err.message || err);
    }
}

// ------------------- Take screenshot if interval reached -------------------
async function checkAndTakeScreenshot() {
    if (!screenshotConfig.enabled || screenshotConfig.intervalMinutes <= 0) return;

    const now = Date.now();
    const intervalMs = screenshotConfig.intervalMinutes * 60 * 1000;

    if (now - lastScreenshotTime >= intervalMs) {
        try {
            const imgBuffer = await screenshot({ format: 'png' });
            lastScreenshotTime = now;
            console.log('Screenshot taken at', new Date().toLocaleTimeString());

            await sendScreenshotToAPI(imgBuffer);
        } catch (err) {
            console.error('Error taking screenshot:', err.message || err);
        }
    }
}

// ------------------- Send screenshot to API -------------------
async function sendScreenshotToAPI(imageBuffer) {
    if (!currentUser) return;

    try {
        const base64Image = imageBuffer.toString('base64');

        const payload = {
            EmpId: currentUser.id,
            Timestamp: new Date().toISOString(),
            ScreenshotImg: base64Image
        };

        await api.post('/UserActivity/UploadScreenshot', payload);
        console.log('Screenshot sent to API at', payload.Timestamp);
    } catch (err) {
        console.error('Error sending screenshot to API:', err.message || err);
    }
}

function stop() {
    if (configInterval) {
        clearInterval(configInterval);
        configInterval = null;
    } 
    if (screenshotInterval) {
        clearInterval(screenshotInterval);
        screenshotInterval = null;
    } 
    currentUser = null;
    isInitialized = false; 
    console.log("Screenshot tracker stopped");
}


// ------------------- Exports -------------------
module.exports = { init , stop};
