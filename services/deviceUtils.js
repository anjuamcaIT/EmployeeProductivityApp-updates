const os = require('os');
const crypto = require('crypto');
const { networkInterfaces } = require('os');

function getMacAddress() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                return net.mac;
            }
        }
    }
    return null;
}

function getOSInfo() {
    return `${os.type()} ${os.release()}`;
}

function generateDeviceId() {
    const mac = getMacAddress() || '';
    const osInfo = getOSInfo();
    return crypto.createHash('sha256').update(mac + osInfo).digest('hex');
}

module.exports = { getMacAddress, getOSInfo, generateDeviceId };
