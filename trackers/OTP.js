const api = require('../services/apiClient'); 
let otpConfig = { OTPCode: '', OTPSecs: 180 };
let onOTPUpdate = null;

// ------------------- Fetch OTP from API -------------------
async function fetchOTP(empId) {
    try {
       
        const response = await api.get(`/UserActivity/GetOTPCode?EmpId=${encodeURIComponent(empId)}`); 
        otpConfig = {
            OTPCode: response.data.otpCode, 
            OTPSecs: response.data.otpSecs
        }; 
        //console.log('OTP settings updated:', otpConfig); 
        if (onOTPUpdate) onOTPUpdate(otpConfig);

        return otpConfig;
    } catch (err) {
        console.error('Error fetching OTP:', err);
        return { OTPCode: '', OTPSecs: 180 };
    }
}

// ------------------- Register UI callback -------------------
function onUpdate(callback) {
    onOTPUpdate = callback;
}

module.exports = {
    fetchOTP,
    onUpdate
};
