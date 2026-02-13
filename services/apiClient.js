const axios = require('axios'); 
// Axios instance
const api = axios.create({
    baseURL: 'http://localhost:5036/api', // your base URL
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
});

const RootURL = api.defaults.baseURL.replace('/api', '');

// ----------------- Internet Check -----------------
let isOnlineModule;

async function checkInternet() {
    if (!isOnlineModule) {
        isOnlineModule = await import('is-online');
    }
    return isOnlineModule.default(); 
}

// ----------------- API Request Wrapper -----------------
async function request(method, url, data = null, config = {}) {
    try {
        const online = await checkInternet();
        if (!online) throw new Error('No internet connection');

        // Keep full Axios response so response.data still works
        const response = await api.request({
            method,
            url,
            data,
            ...config
        });

        return response; // <-- return full response

    } catch (err) {
        console.error(`[API Error] ${method.toUpperCase()} ${url}:`, err.message || err);

        // Optional: Retry automatically after 5 seconds if offline
        if (err.message && err.message.includes('No internet')) {
            console.log('Retrying in 5 seconds...');
            await new Promise(res => setTimeout(res, 5000));
            return request(method, url, data, config); // retry
        }
        return { data: null, status: 0, statusText: 'Error', headers: {}, config: {} };
    }
}

// ----------------- Expose helper functions -----------------
module.exports = {
    api,  
    RootURL, 
    get: (url, params = {}, config = {}) => request('get', url, null, { ...config, params }),
    post: (url, data = {}, config = {}) => request('post', url, data, config),
    put: (url, data = {}, config = {}) => request('put', url, data, config),
    delete: (url, config = {}) => request('delete', url, null, config)
};
