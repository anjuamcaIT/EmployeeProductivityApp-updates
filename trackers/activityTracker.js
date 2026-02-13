const path = require('path');
const os = require('os'); 
const api = require('../services/apiClient');

let addon;
let lastActivityTime = Date.now();
let idleStartTime = null;
let currentHourKey = null;
let keyboardHookActive = false;
let mouseHookActive = false;
let systemHookActive = false;

let activityInterval = null;
let isTracking = false;

const IDLE_LIMIT_MINUTES = 5;  
const hourStats = {};
let currentUser = null;

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
//console.log('Detected user timezone:', TIMEZONE);

// ------------------- Helpers ------------------- 
function getHourKey() { 
    //const now = new Date();  
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
} 
 
function ensureHourStats(hourKey) {
    const now = Date.now();
    if (!hourStats[hourKey]) {
        hourStats[hourKey] = {
            keystrokes: 0, 
            firstActive: null,      
            lastActive: null,      
            idleMinutes: 0,
            idlePeriods: [],
            currentIdleStart: null  
            
        };
    } else {
        if (!(hourStats[hourKey].firstActive instanceof Date)) {
            hourStats[hourKey].firstActive = new Date(now);
        }
        if (!(hourStats[hourKey].lastActive instanceof Date)) {
            hourStats[hourKey].lastActive = new Date(now);
        }
    }
}

// Finalize stats for an hour (handle idle periods before sending)
function finalizeHourStats(hourKey) {
    const stats = hourStats[hourKey];
    if (!stats) return;

    if (idleStartTime) {
        const now = Date.now();
        const idleMinutes = (now - idleStartTime) / 60000;
        if (idleMinutes >= IDLE_LIMIT_MINUTES) {
            stats.idleMinutes += idleMinutes;
            stats.idlePeriods.push({
               start: new Date(idleStartTime).toLocaleString('en-US', { timeZone: TIMEZONE }), 
               end: new Date(now).toLocaleString('en-US', { timeZone: TIMEZONE }),
                durationMinutes: idleMinutes.toFixed(2)
            });
        }
        idleStartTime = null;
    }
}

// ------------------- API Call -------------------

async function sendHourlyData(hourKey, stats) { 
    if (!stats) return; 
    const [year, month, day, hour] = hourKey.split('-').map(Number); 
    const CurrentTimeDate = new Date().toLocaleString('en-CA', {
    timeZone: TIMEZONE,
    hour12: false
    }).replace(',', '')

    const activity = {
        EmpId: currentUser.id,
        ActivityStartTimeDate: CurrentTimeDate, 
        ActivityDate:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        ActivityHour: hour,
        KeyStrokeCount: stats.keystrokes,
        IdleMinutes: Math.floor(stats.idleMinutes),
        IdlePeriods: JSON.stringify(stats.idlePeriods), 
        FirstActiveTimeDate: formatDateToTimeZoneISO(stats.firstActive, TIMEZONE),
        LastActiveTimeDate: formatDateToTimeZoneISO(stats.lastActive, TIMEZONE), 
        HostName: os.hostname(),
        CreatedBy: 1
    };

    try {
        await api.post('/UserActivity/UploadActivity', activity);
        //console.log(`Hourly data sent for ${hourKey}`);
    } catch (err) {
        //console.error('Error sending hourly data:', err.message || err);
    }
}

 
// ------------------- Activity Registration -------------------
 
function registerActivity(type) {
    const now = Date.now(); 
    const hourKey = getHourKey();
    ensureHourStats(hourKey);
    const stats = hourStats[hourKey];

    if (type === 'keyboard') stats.keystrokes += 1;

   
    if (!stats.firstActive) stats.firstActive = new Date(now);
     stats.lastActive = new Date(now);
 
    if (stats.currentIdleStart) {
        const idleMinutes = (now - stats.currentIdleStart) / 60000;
        if (idleMinutes >= IDLE_LIMIT_MINUTES) {
            stats.idlePeriods.push({
                start: new Date(stats.currentIdleStart).toLocaleString('en-US', { timeZone: TIMEZONE }),
                end: new Date(now).toLocaleString('en-US', { timeZone: TIMEZONE }),
                durationMinutes: idleMinutes.toFixed(2)
            });
        }
        stats.currentIdleStart = null;
    }

    // update cumulative idleMinutes for dashboard
    stats.idleMinutes = stats.idlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0);

    lastActivityTime = now;
} 
 

// Idle Tracking interval
setInterval(() => {
    const now = Date.now();
    const hourKey = getHourKey();
    ensureHourStats(hourKey);
    const stats = hourStats[hourKey];

    const diffMinutes = (now - lastActivityTime) / 60000;

    // Hour changed
    if (currentHourKey && currentHourKey !== hourKey) {
        const prevStats = hourStats[currentHourKey];

        // Handle ongoing idle for previous hour
        if (prevStats.currentIdleStart) {
           const nowDate = new Date();
           const prevHourEnd = new Date(now);
           prevHourEnd.setMinutes(0, 0, 0);  
        prevHourEnd.setSeconds(0, 0); // top of new hour

            const minutesInPrevHour = (prevHourEnd - prevStats.currentIdleStart) / 60000;

            if (minutesInPrevHour >= 0) {
                prevStats.idlePeriods.push({
                    start: new Date(prevStats.currentIdleStart).toLocaleString('en-US', { timeZone: TIMEZONE }),
                    end: prevHourEnd.toLocaleString('en-US', { timeZone: TIMEZONE }),
                    durationMinutes: minutesInPrevHour.toFixed(2)
                });
                prevStats.idleMinutes = prevStats.idlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0);
            }

            // Start new idle for current hour
            //stats.currentIdleStart = prevHourEnd;
             const newStats = hourStats[hourKey];
             newStats.currentIdleStart = prevHourEnd;
        }

        finalizeHourStats(currentHourKey);
        sendHourlyData(currentHourKey, prevStats);
    }

    currentHourKey = hourKey;

    // Detect idle start
    if (diffMinutes >= IDLE_LIMIT_MINUTES) {
        if (!stats.currentIdleStart) {
            stats.currentIdleStart = lastActivityTime;
        }

        // Update live idleMinutes for dashboard
        stats.idleMinutes = stats.idlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0)
                            + (now - stats.currentIdleStart) / 60000;
    } else {
        stats.currentIdleStart = null; // reset when active
    }
}, 10000);


  

// ------------------- Start Tracker -------------------

function startActivityTracker(user) {
     
    currentUser = user ;
    addon = require(path.join(__dirname, '../native/build/Release/keyboard_mouse.node'));
    //console.log('Starting activity tracker for user:', currentUser.id);

    // Keyboard events
    if (!keyboardHookActive) {
    addon.startKeyboardHook((vkCode) => {
         if (!isTracking) return; // ✅ stop processing after logout
        registerActivity('keyboard');
        const hourKey = getHourKey();
        //console.log(`[${user}] Key pressed: ${vkCode} | Hour: ${hourKey} | Keystrokes: ${hourStats[hourKey].keystrokes}`);
        keyboardHookActive = true;
    });
    }

    // Mouse events
     if (!mouseHookActive) {
    addon.startMouseHook(() => {
         if (!isTracking) return;  
        registerActivity('mouse');
        const hourKey = getHourKey();
        //console.log(`[${user}] Mouse activity detected | Hour: ${hourKey} | Last Active: ${hourStats[hourKey].lastActive.toLocaleTimeString()}`);
        mouseHookActive = true;
    });
}

    // ✅ System / Remote activity (Quick Assist, Teams, AnyDesk)
     if (!systemHookActive) {
    addon.startSystemHook(() => {
         if (!isTracking) return;  
        registerActivity('system');
        const hourKey = getHourKey();
        //console.log(`[${user}] System / Remote activity detected | Hour: ${hourKey} | Last Active: ${hourStats[hourKey].lastActive.toLocaleTimeString()}`);
         systemHookActive = true;
    });
}

  // Start idle interval
    if (!isTracking) {
        activityInterval = setInterval(() => {
            trackIdle();  
        }, 10000);
        isTracking = true;
    }
}


function stopActivityTracker() {
    // Clear interval
    if (activityInterval) {
        clearInterval(activityInterval);
        activityInterval = null;
        isTracking = false;
    }

    // Stop hooks if addon supports stop/unhook
    if (addon) {
        if (keyboardHookActive && addon.stopKeyboardHook) {
            addon.stopKeyboardHook();
            keyboardHookActive = false;
        }
        if (mouseHookActive && addon.stopMouseHook) {
            addon.stopMouseHook();
            mouseHookActive = false;
        }
        if (systemHookActive && addon.stopSystemHook) {
            addon.stopSystemHook();
            systemHookActive = false;
        }
    }

    // Reset variables
    currentUser = null;
    lastActivityTime = Date.now();
    idleStartTime = null;
    currentHourKey = null;
    for (const key in hourStats) delete hourStats[key];
    //console.log('Activity tracking stopped.');
}

function trackIdle() {
    const now = Date.now();
    const hourKey = getHourKey();
    ensureHourStats(hourKey);
    const stats = hourStats[hourKey];

    const diffMinutes = (now - lastActivityTime) / 60000;

    // Hour changed
    if (currentHourKey && currentHourKey !== hourKey) {
        const prevStats = hourStats[currentHourKey];
        if (prevStats.currentIdleStart) {
            const prevHourEnd = new Date(now);
            prevHourEnd.setMinutes(0, 0, 0);
            const minutesInPrevHour = (prevHourEnd - prevStats.currentIdleStart) / 60000;
            if (minutesInPrevHour >= 0) {
                prevStats.idlePeriods.push({
                    start: new Date(prevStats.currentIdleStart).toLocaleString('en-US', { timeZone: TIMEZONE }),
                    end: prevHourEnd.toLocaleString('en-US', { timeZone: TIMEZONE }),
                    durationMinutes: minutesInPrevHour.toFixed(2)
                });
                prevStats.idleMinutes = prevStats.idlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0);
            }
            stats.currentIdleStart = prevHourEnd;
        }

        finalizeHourStats(currentHourKey);
        sendHourlyData(currentHourKey, prevStats);
    }

    currentHourKey = hourKey;

    if (diffMinutes >= IDLE_LIMIT_MINUTES) {
        if (!stats.currentIdleStart) stats.currentIdleStart = lastActivityTime;
        stats.idleMinutes = stats.idlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0)
                          + (now - stats.currentIdleStart) / 60000;
    } else {
        stats.currentIdleStart = null;
    }
}

 
function getHourlyReport() {
    const report = [];

    for (const [hour, stats] of Object.entries(hourStats)) {
        const liveIdlePeriods = getLiveIdlePeriods(stats); // include current ongoing idle
        const liveIdleMinutes = liveIdlePeriods.reduce((sum, p) => sum + parseFloat(p.durationMinutes), 0);

        report.push({
            hour,
            totalKeystrokes: stats.keystrokes,
            firstActive: stats.firstActive instanceof Date ? stats.firstActive.toISOString() : null,  
            lastActive: stats.lastActive instanceof Date ? stats.lastActive.toISOString() : null, 
            totalIdleMinutes: Math.floor(liveIdleMinutes),
            idlePeriods: liveIdlePeriods
        });
    }

    report.sort((a, b) => new Date(a.hour) - new Date(b.hour));
    return report;
}


function getLiveIdlePeriods(stats) {
    const periods = [...stats.idlePeriods];  
    if (stats.currentIdleStart) {
        const now = Date.now();
        const idleMinutes = (now - stats.currentIdleStart) / 60000;
        if (idleMinutes >= 0) { 
            periods.push({
                start: new Date(stats.currentIdleStart).toLocaleString('en-US', { timeZone: TIMEZONE }),
                end: new Date(now).toLocaleString('en-US', { timeZone: TIMEZONE }),
                durationMinutes: idleMinutes.toFixed(2)
            });
        }
    }
    return periods;
} 
 
function formatDateToTimeZoneISO(date, timeZone) {
    const d = new Date(date);
    const options = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value });
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`;
}  


module.exports = { startActivityTracker , stopActivityTracker , getHourlyReport };
