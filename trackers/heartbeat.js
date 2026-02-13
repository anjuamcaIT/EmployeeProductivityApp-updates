const os = require('os'); 
const { getMacAddress, getOSInfo, generateDeviceId } = require('../services/deviceUtils');  
const api = require('../services/apiClient');

let heartbeatInterval = null;
let currentUser = null;
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Start sending heartbeat every X seconds
function startHeartbeat(user) {
    currentUser = user;
 console.log('Heartbeat started:');
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    heartbeatInterval = setInterval(() => {
        sendHeartbeat();
    }, 60 * 1000); // every 1 minute
}

// Stop heartbeat
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    currentUser = null;
}

// Send heartbeat to API
async function sendHeartbeat() {
    if (!currentUser) return;

    const payload = {
        EmpId: currentUser.id,
        HostName: os.hostname(),
        MacAddress: getMacAddress(),
        DeviceId: generateDeviceId(),
        OS: getOSInfo(),
        TimeZone: TIMEZONE,
        LastHeartbeat: new Date().toISOString()
    };

    try {
        await api.post('/UserActivity/heartbeat', payload);
        console.log(`[Heartbeat] Sent for ${payload.HostName} at ${payload.LastHeartbeat}`);
    } catch (err) {
        console.error('[Heartbeat] Error:', err.message || err);
    }
}

module.exports = { startHeartbeat, stopHeartbeat };
