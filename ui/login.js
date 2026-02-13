 
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const messageDiv = document.getElementById('messageDiv');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const securityKey = document.getElementById('securityKey').value.trim();

    if (!userId || !password || !securityKey) {
      messageDiv.innerText = 'Please fill all fields';
      return;
    } 
    messageDiv.innerText = 'Logging in...';  
    
    const deviceInfo = await window.electronAPI.getDeviceInfo(); 
     const loginData = {
      UserId: userId,
      Password: password,
      SecurityKey: securityKey,
      HostName: deviceInfo.hostname,
      RegisteredDateTime: deviceInfo.loginDateTime,
      RegisterdTimeZone: deviceInfo.timezone,
      MacAddress: deviceInfo.mac,
      OS: deviceInfo.os,
      DeviceId: deviceInfo.deviceId
    };

    try {
      const result = await window.electronAPI.loginWithAPI(loginData);
      if (result.success) {
       // window.electronAPI.sendUsername(result.employeeDetails);  
        window.electronAPI.loginSuccess({
        employeeDetails: result.employeeDetails,
        token: result.token
    });
        messageDiv.innerText = 'Login successful!';
      } else {
        messageDiv.innerText = result.message || 'Login failed';
      }
    } catch (err) {
      console.error('Login error:', err);
      messageDiv.innerText = 'Login failed';
    }
  });


  function getSystemDateTime() {
  return new Date().toLocaleString('en-CA', {
    timeZone: window.electronAPI.getSystemTimeZone(),
    hour12: false
  }).replace(',', '');
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    const dateStr = now.toLocaleDateString(undefined, options);
    const timeStr = now.toLocaleTimeString();
    document.getElementById('dateTime').textContent = `${dateStr} | ${timeStr}`;
}

 
setInterval(updateDateTime, 1000);
updateDateTime(); 

});


