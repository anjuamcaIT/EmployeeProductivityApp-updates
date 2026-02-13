async function loadUserMenu(containerId = 'userMenuContainer') {
    try {
        // Inject HTML
        const container = document.getElementById(containerId);
        if (!container) return console.warn('User menu container not found');

        const html = await window.electronAPI.loadUserMenu();
        container.innerHTML = html; 
        setupVerticalMenu(container);

        // Elements
        const userMenu = container.querySelector('#userMenu');
        const dropdownContent = userMenu.querySelector('.dropdown-content');
        const logoutBtn = container.querySelector('#logoutBtn');
        const OTPBtn = container.querySelector('#OTPBtn'); 
        const ProdBtn = container.querySelector('#ProdBtn');
        const InfoOTPBtn = container.querySelector('#InfoOTPBtn');
        const InfoProdBtn = container.querySelector('#InfoProdBtn');
        const modal = document.getElementById('logoutModal');
        const closeBtn = modal.querySelector('.closeBtn');
        const confirmLogout = modal.querySelector('#confirmLogout');
        const securityKeyInput = modal.querySelector('#securityKeyInput');
        const logoutError = modal.querySelector('#logoutError');
        const empName = container.querySelector('#empName');
        const empId = container.querySelector('#empId');
        const profilePic = container.querySelector('#profilePic');

        // Load user info
        const auth = await window.electronAPI.getAuth();
        if (auth && auth.isLoggedIn) {
            empName.innerText = auth.user.name;
            empId.innerText = auth.user.id;
            profilePic.src = auth.user.profilepic;
        } 

        // Register IPC listener **after modal exists**
            window.electronAPI.on('request-quit', () => {
                if (modal) {
                    modal.style.display = 'block';
                }
            });
       
        // Toggle dropdown
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.style.display = dropdownContent.style.display === 'flex' ? 'none' : 'flex';
        });

        // Close dropdown if clicked outside
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target)) dropdownContent.style.display = 'none';
        });

        // Logout modal
        logoutBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            securityKeyInput.value = '';
            logoutError.style.display = 'none';
            securityKeyInput.focus();
        });

        closeBtn.addEventListener('click', () => modal.style.display = 'none');

        window.addEventListener('click', (event) => {
            if (event.target === modal) modal.style.display = 'none';
        });

        // OTP navigation
        OTPBtn.addEventListener('click', () => window.location.href = 'OTP.html');
        InfoOTPBtn.addEventListener('click', () => window.location.href = 'OTP.html');

         // Productivity navigation
        ProdBtn.addEventListener('click', () => window.location.href = 'dashboard.html');
        InfoProdBtn.addEventListener('click', () => window.location.href = 'dashboard.html');

        // Confirm logout
        confirmLogout.addEventListener('click', async () => {
            const key = securityKeyInput.value.trim();
            if (!key) return;

            logoutError.style.display = 'none';
            try {
                const auth = await window.electronAPI.getAuth();
                if (!auth || !auth.isLoggedIn) return;

                const result = await window.electronAPI.validateSecurityKey(auth.user.id, key);

                if (result.isValid) {
                    await window.electronAPI.stopActivityTracking();
                    await window.electronAPI.clearAuth();
                    window.location.href = 'login.html';
                    //window.electronAPI.quitApp();
                } else {
                    logoutError.innerText = result.message || 'Invalid Security Key';
                    logoutError.style.display = 'block';
                }
            } catch (err) {
                logoutError.innerText = 'Error validating key';
                logoutError.style.display = 'block';
                console.error(err);
            }
        });

    } catch (err) {
        console.error('Failed to load user menu:', err);
    }

   

function loadFontAwesome() {
    if (document.getElementById('fa-script')) return;

    const script = document.createElement('script');
    script.id = 'fa-script';
    script.src = 'js/fontawesome.js';
    script.defer = true;
    document.head.appendChild(script);
}

loadFontAwesome();

window.electronAPI.on('internet-restored', async () => {
    console.log('Internet restored! Refreshing APIs...');
    const auth = await window.electronAPI.getAuth();
    if (auth && auth.isLoggedIn) {
        await window.electronAPI.OTP.init();   // refresh OTP
        await window.electronAPI.loadUserMenu(); // reload user menu
        // call any other APIs you need
    }
});

 function setupVerticalMenu(container) {
    const menuContainer = container.querySelector('#verticalMenu');
    if (!menuContainer) return;

    const menuItems = menuContainer.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Optional: restore previous active item from localStorage
    const activeId = localStorage.getItem('activeMenu');
    if (activeId) {
        const activeItem = menuContainer.querySelector(`#${activeId}`);
        if (activeItem) activeItem.classList.add('active');
    }

    // Save active item on click
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            localStorage.setItem('activeMenu', item.id);
        });
    });
}


}
