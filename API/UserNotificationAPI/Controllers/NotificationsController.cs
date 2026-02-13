using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Data.SqlClient;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using UserNotificationAPI.Models;

namespace UserNotificationAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationsController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        public NotificationsController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }
       

        [HttpGet("{userId}")]
        public ActionResult<IEnumerable<Notification>> GetNotifications(string userId)
        {
            string connectionString = _configurationService.GetConnectionString();
            var notifications = new List<Notification>();

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId",userId);
                    cmd.Parameters.AddWithValue("@OpCode",2);
                    con.Open();
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var id = reader["Id"].ToString();
                            var title = reader["Title"].ToString();
                            var body = reader["Body"].ToString();
                            var issent = reader["IsSeen"].ToString();
                            var CreatedTime = reader["CreatedTime"].ToString();
                            var TimeDate = reader["CreatedOn"].ToString();
                            if (!string.IsNullOrEmpty(id) && !string.IsNullOrEmpty(title) && !string.IsNullOrEmpty(body) && !string.IsNullOrEmpty(issent) && !string.IsNullOrEmpty(CreatedTime))
                            {
                                var notification = new Notification
                                {
                                    Id = id,
                                    Title = title,
                                    Body = body,
                                    IsSeen = issent,
                                    SentTime = CreatedTime,
                                    CreatedDate = TimeDate,
                                };
                                notifications.Add(notification);
                            }
                        }
                    }
                    if (notifications.Count == 0)
                    {
                        return NoContent(); 
                    }
                    return Ok(notifications);
                }
            }
        }


        [HttpPut("{id}")]
        public ActionResult UpdateNotifications(string id)
        {
            string connectionString = _configurationService.GetConnectionString();
            var notifications = new List<Notification>();

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@notificationId", id);
                    cmd.Parameters.AddWithValue("@OpCode", 4);
                    con.Open();
                    int rowsAffected = cmd.ExecuteNonQuery();
                    if (rowsAffected > 0)
                    {
                        return Ok(new { message = "Notification marked as seen." });
                    }
                    else
                    {
                        return NotFound(new { message = "Notification not found." });
                    }
                }
            }
        }
    }
}
