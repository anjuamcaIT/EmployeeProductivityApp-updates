
async function updateDashboard() {
    try {
        const report = await window.electronAPI.getHourlyStats();
        if (report.length > 0) {
            const currentHourStats = report[report.length - 1];

            // Correct property names
            const lastActive = currentHourStats.lastActive ? new Date(currentHourStats.lastActive) : new Date();
            const now = new Date();
            const secondsSinceLastActive = Math.floor((now - lastActive) / 1000);

            // Update DOM
            // document.getElementById('activeTime').innerText =
            //     `${secondsSinceLastActive} sec ago (${lastActive.toLocaleTimeString()})`;
            document.getElementById('activeTime').innerText =
    `${formatTimeAgo(secondsSinceLastActive)} (${lastActive.toLocaleTimeString()})`;
            document.getElementById('keyCount').innerText = currentHourStats.totalKeystrokes;
            document.getElementById('idleMinutes').innerText = currentHourStats.totalIdleMinutes;

            // Idle Periods
            const idleListEl = document.getElementById('idlePeriods');
            idleListEl.innerHTML = ''; // clear previous
            const idlePeriods = currentHourStats.idlePeriods || [];
            if (currentHourStats.idlePeriods.length > 0) {
                currentHourStats.idlePeriods.forEach(period => {
                    const li = document.createElement('li'); 
                    // Format start and end as HH:MM
                    const startTime = new Date(period.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(period.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    li.innerText = `${startTime} → ${endTime} (${period.durationMinutes} min)`;
                    idleListEl.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.innerText = 'No idle periods';
                idleListEl.appendChild(li);
            }

            console.log(`Hour ${currentHourStats.hour}: Keys=${currentHourStats.totalKeystrokes}, Idle=${currentHourStats.totalIdleMinutes}min, LastActive=${lastActive.toLocaleTimeString()}`);
 
            // Update Activity Hour Section
            // -------------------------------
            // Use the hour from your report entry
            let hour = Number(currentHourStats.hour);
            if (isNaN(hour) || hour < 0 || hour > 23) {
                // fallback to current system hour
                hour = new Date().getHours();
            }
            
            // let startHour = hour % 24;
            // let endHour = (hour + 1) % 24;

            // function formatHour(h) {
            //     const ampm = h >= 12 ? 'PM' : 'AM';
            //     let hour12 = h % 12;
            //     if (hour12 === 0) hour12 = 12;
            //     return `${hour12}:00 ${ampm}`;
            // }

            // document.getElementById('activityHour').innerText =
            //     `Activity Hour: ${formatHour(startHour)} – ${formatHour(endHour)}`;
            
            const [year, month, day, hourStr] = currentHourStats.hour.split('-').map(Number);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedDate = `${String(day).padStart(2,'0')}-${monthNames[month-1]}-${year}`;

            const startHour = hourStr % 24;
            const endHour = (hourStr + 1) % 24;

            function formatHour(h) {
                const ampm = h >= 12 ? 'PM' : 'AM';
                let hour12 = h % 12;
                if (hour12 === 0) hour12 = 12;
                return `${hour12}:00 ${ampm}`;
            }

            document.getElementById('activityHour').innerText =
                `${formattedDate} - ( ${formatHour(startHour)} – ${formatHour(endHour)} ) `;

        }
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
    }
}

function formatTimeAgo(seconds) {
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}


document.addEventListener('DOMContentLoaded', () => {
    window.electronAPI.loadUserMenu('userMenuContainer');
});

updateDashboard(); 
// Refresh every 5 seconds
 setInterval(updateDashboard, 5000);
 
