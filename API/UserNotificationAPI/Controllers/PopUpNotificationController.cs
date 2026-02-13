using Microsoft.AspNetCore.Mvc;
using UserNotificationAPI.Services;

namespace UserNotificationAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PopUpNotificationController : ControllerBase
    {
        private readonly NotificationService _notificationService;

        public PopUpNotificationController(NotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendNotification(
            string userId,
            string title,
            string message)
        {
            await _notificationService.SendNotification(userId, title, message);

            return Ok();
        }
    }
}
