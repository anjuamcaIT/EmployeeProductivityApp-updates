const { autoUpdater } = require('electron-updater');
autoUpdater.on('checking-for-update', () => console.log('Checking for update...'));
autoUpdater.on('update-available', info => console.log('Update available:', info));
autoUpdater.on('update-downloaded', () => { autoUpdater.quitAndInstall(); });
function checkForUpdates() { autoUpdater.checkForUpdatesAndNotify(); }
module.exports = { checkForUpdates };
