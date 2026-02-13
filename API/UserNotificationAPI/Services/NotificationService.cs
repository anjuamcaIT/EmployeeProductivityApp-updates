using Microsoft.AspNetCore.SignalR;
using UserNotificationAPI.Hubs;

namespace UserNotificationAPI.Services
{
    public class NotificationService
    {
        private readonly IHubContext<NotificationHub> _hubContext;

        public NotificationService(IHubContext<NotificationHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task SendNotification(string userId, string title, string message)
        {
            // Send to all connected clients
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", new
            {
                userId = userId,
                title = title,
                message = message
            });
        }
    }
}
