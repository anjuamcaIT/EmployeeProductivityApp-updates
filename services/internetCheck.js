// services/internetCheck.js
let isOnlineModule;

async function checkInternet() {
    if (!isOnlineModule) {
        isOnlineModule = await import('is-online'); // dynamic import
    }
    return isOnlineModule.default();
}

module.exports = checkInternet;
