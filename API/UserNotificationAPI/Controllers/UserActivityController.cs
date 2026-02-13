using System.Xml.Linq;
using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using System.Data;
using UserNotificationAPI.Models;
using System.Text.Json;
using System.Globalization;

namespace UserNotificationAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class UserActivityController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        public UserActivityController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        }

        [HttpPost("UploadActivity")]
        public IActionResult GetActivity([FromBody] UserActivity userActivity)
        {
            string connectionString = _configurationService.GetConnectionString(); 
            string idlePeriodsXml = "<IdlePeriods>";

            if (!string.IsNullOrEmpty(userActivity.IdlePeriods))
            {
                var idlePeriods = JsonSerializer.Deserialize<List<IdlePeriod>>(userActivity.IdlePeriods)
                                  ?? new List<IdlePeriod>();

                foreach (var idle in idlePeriods)
                {
                    DateTime startTime = DateTime.Parse(idle.start, CultureInfo.InvariantCulture);
                    DateTime endTime = DateTime.Parse(idle.end, CultureInfo.InvariantCulture);
                    decimal idleMins = decimal.Parse(idle.durationMinutes, CultureInfo.InvariantCulture);

                    idlePeriodsXml +=
                        $"<IdlePeriod>" +
                        $"<StartTime>{startTime:yyyy-MM-ddTHH:mm:ss}</StartTime>" +
                        $"<EndTime>{endTime:yyyy-MM-ddTHH:mm:ss}</EndTime>" +
                        $"<IdleMinutes>{idleMins}</IdleMinutes>" +
                        $"</IdlePeriod>";
                }
            } 
            idlePeriodsXml += "</IdlePeriods>";


            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", userActivity.EmpId);
                    cmd.Parameters.AddWithValue("@ActivityDate", userActivity.ActivityDate);
                    cmd.Parameters.AddWithValue("@LastActiveTimeDate", userActivity.LastActiveTimeDate);
                    cmd.Parameters.AddWithValue("@FirstActiveTimeDate", userActivity.FirstActiveTimeDate);
                    cmd.Parameters.AddWithValue("@ActivityStartTimeDate", userActivity.ActivityStartTimeDate);
                    cmd.Parameters.AddWithValue("@ActivityHour", userActivity.ActivityHour);
                    cmd.Parameters.AddWithValue("@KeyStrokeCount", userActivity.KeyStrokeCount);
                    cmd.Parameters.AddWithValue("@IdleMinutes", userActivity.IdleMinutes); 
                    cmd.Parameters.Add("@IdlePeriodsXML", SqlDbType.Xml).Value = idlePeriodsXml;
                    cmd.Parameters.AddWithValue("@HostName", userActivity.HostName);
                    cmd.Parameters.AddWithValue("@HourActivityStartTimeDate", userActivity.FirstActiveTimeDate);
                    cmd.Parameters.AddWithValue("@OpCode", 3);
                    con.Open();
                    try
                    {
                        cmd.ExecuteNonQuery();
                        return NoContent(); 
                    }
                    catch
                    {
                        
                    }
                }
            }
            return NoContent(); 
        }

        [HttpGet("GetScreenshotSettings")]
        public ActionResult<ScreenshotSettings> GetScreenshotSettings(string empId)
        {
            string connectionString = _configurationService.GetConnectionString();
            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", empId);
                    cmd.Parameters.AddWithValue("@OpCode", 7);

                    con.Open();
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            bool enabled = reader["IsScreenShotEnabled"] != DBNull.Value && (bool)reader["IsScreenShotEnabled"];
                            int intervalMinutes = reader["EnabledMins"] != DBNull.Value ? Convert.ToInt32(reader["EnabledMins"]) : 0;

                            var settings = new ScreenshotSettings
                            {
                                Enabled = enabled,
                                IntervalMinutes = intervalMinutes
                            };

                            return Ok(settings);
                        }
                        else
                        {
                            return Unauthorized();
                        }
                    }
                }
            }
        }  

        [HttpPost("UploadScreenshot")] 
        public async Task<IActionResult> UploadScreenshot([FromBody] ScreenshotUpload request) 
        { 
            if (request == null || string.IsNullOrEmpty(request.ScreenshotImg)) 
                return BadRequest("Invalid request data."); 
            try 
            { 
                string filePath = ""; 
                string connectionString = _configurationService.GetConnectionString(); 
                string base64String = request.ScreenshotImg.Trim(); 
                string base64Prefix = "data:image/png;base64,"; 
                if (base64String.StartsWith(base64Prefix)) 
                {
                    base64String = base64String.Substring(base64Prefix.Length); 
                } 
                byte[] imageBytes = Convert.FromBase64String(base64String); 
                string currentDirectory = AppDomain.CurrentDomain.BaseDirectory; 
                string projectRootDirectory = "UploadedFile";
                string folderPath = Path.Combine(projectRootDirectory, "Screenshots"); 
                if (!Directory.Exists(folderPath)) 
                {
                    Directory.CreateDirectory(folderPath); 
                } 
                string fileName = "";
                string FullfilePath = "";
                using (SqlConnection con = new SqlConnection(connectionString)) 
                {
                    using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.Parameters.AddWithValue("@UserId", request.EmpId);
                        cmd.Parameters.AddWithValue("@ActivityDate", request.Timestamp);
                        cmd.Parameters.AddWithValue("@OpCode", 6);
                        con.Open();
                        int shiftover = 0;
                        using (SqlDataReader reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                shiftover = reader.GetInt32(0);
                            }
                            else
                            {
                                return BadRequest("No notification data found for the user.");
                            }
                        }

                        if (shiftover != 0)
                            return BadRequest("Cannot upload screenshot: shift is over.");
                    }
                    fileName = Guid.NewGuid().ToString() + ".png";
                    filePath = Path.Combine(folderPath, fileName);
                    FullfilePath = "/UploadedFile/Screenshots/" + fileName;
                    System.IO.File.WriteAllBytes(filePath, imageBytes);
                    using (SqlCommand saveCmd = new SqlCommand("GetUserNotificationData", con))
                    {
                        saveCmd.CommandType = CommandType.StoredProcedure;
                        saveCmd.Parameters.AddWithValue("@UserId", request.EmpId);
                        saveCmd.Parameters.AddWithValue("@ActivityStartTimeDate", request.Timestamp);
                        saveCmd.Parameters.AddWithValue("@OpCode", 8);
                        saveCmd.Parameters.AddWithValue("@Screenshot", FullfilePath);
                        await saveCmd.ExecuteNonQueryAsync();
                    } 
                }
                return Ok(new { Message = "Screenshot uploaded successfully.", FileName = fileName }); 
            } 
            catch (FormatException) 
            {
                return BadRequest("Invalid Base64 string for image."); 
            } 
            catch (Exception ex) 
            { 
                return StatusCode(500, $"Error saving screenshot: {ex.Message}");
            } 
        }

        [HttpPost("validateSecurityKey")]
        public ActionResult<SecurityKeyResponse> ValidateSecurityKey(string empId, string SecurityKey , string HostName, string MacAddress, string DeviceID, string OsName)
        {
            string connectionString = _configurationService.GetConnectionString();
            int isSame = 0;

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", empId);
                    cmd.Parameters.AddWithValue("@SecurityKey", SecurityKey);
                    cmd.Parameters.AddWithValue("@HostName", HostName);
                    cmd.Parameters.AddWithValue("@MacAddress", MacAddress);
                    cmd.Parameters.AddWithValue("@DeviceId", DeviceID);
                    cmd.Parameters.AddWithValue("@OS", OsName);
                    cmd.Parameters.AddWithValue("@OpCode", 9);
                    con.Open();

                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            isSame = reader.GetInt32(0); 
                        }
                        else
                        {
                            return Ok(new SecurityKeyResponse { IsValid = false, Message = "Wrong Security Key" });
                        }
                    }
                }
            }

            if (isSame == 1)
            {
                return Ok(new SecurityKeyResponse { IsValid = true, Message = "Security Key Verified" });
            }
            else
            {
                return Ok(new SecurityKeyResponse { IsValid = false, Message = "Wrong Security Key" });
            }
        }

        [HttpGet("GetOTPCode")]
        public IActionResult GetOTPCode(string empId)
        {
            string connectionString = _configurationService.GetConnectionString(); 
            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", empId); 
                    cmd.Parameters.AddWithValue("@OpCode", 10);
                    con.Open();
                    try
                    {
                        using (SqlDataReader reader = cmd.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                string Otpcode = reader["OTPCode"] != DBNull.Value ? Convert.ToString(reader["OTPCode"]) : "";
                                int secs = reader["OTPSecs"] != DBNull.Value ? Convert.ToInt32(reader["OTPSecs"]) : 180;

                                var otpsettings = new UserOTP
                                {
                                    OTPCode = Otpcode,
                                    OTPSecs = secs
                                };

                                return Ok(otpsettings);
                            }
                            else
                            {
                                return Unauthorized();
                            }
                        }
                    }
                    catch
                    {

                    }
                }
            }
            return NoContent();
        }


        [HttpPost("heartbeat")]
        public IActionResult Heartbeat([FromBody] DeviceHeartbeat heartbeat)
        {
           string connectionString = _configurationService.GetConnectionString();

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure; 
                    cmd.Parameters.AddWithValue("@UserId", heartbeat.EmpId);
                    cmd.Parameters.AddWithValue("@MacAddress", heartbeat.MacAddress);
                    cmd.Parameters.AddWithValue("@RegisteredDateTime", heartbeat.LastHeartbeat);
                    cmd.Parameters.AddWithValue("@RegisterdTimeZone", heartbeat.TimeZone);
                    cmd.Parameters.AddWithValue("@DeviceId", heartbeat.DeviceId);
                    cmd.Parameters.AddWithValue("@OS", heartbeat.OS);
                    cmd.Parameters.AddWithValue("@HostName", heartbeat.HostName);
                    cmd.Parameters.AddWithValue("@OpCode", 12); // Logout / update record

                    con.Open();
                    try
                    {
                        cmd.ExecuteNonQuery();
                        return Ok(new { success = true, message = "Heartbeat updated" });
                    }
                    catch (Exception ex)
                    {
                        return StatusCode(500, new { success = false, message = ex.Message });
                    }
                }
            }
        }

        // Start Old Code

        [HttpPost("GetActivity")]
        public IActionResult GetActivity1([FromBody] UserActivity userActivity)
        {
            string connectionString = _configurationService.GetConnectionString();

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", userActivity.EmpId);
                    cmd.Parameters.AddWithValue("@ActivityDate", userActivity.ActivityDate);
                    cmd.Parameters.AddWithValue("@ActivityStartTimeDate", userActivity.ActivityStartTimeDate);
                    cmd.Parameters.AddWithValue("@ActivityHour", userActivity.ActivityHour);
                    cmd.Parameters.AddWithValue("@KeyStrokeCount", userActivity.KeyStrokeCount);
                    cmd.Parameters.AddWithValue("@IdleMinutes", userActivity.IdleMinutes);
                    cmd.Parameters.AddWithValue("@HostName", userActivity.HostName);
                    cmd.Parameters.AddWithValue("@HourActivityStartTimeDate", userActivity.HourActivityStartTimeDate);
                    cmd.Parameters.AddWithValue("@OpCode", 30);
                    con.Open();
                    try
                    {
                        cmd.ExecuteNonQuery();
                        return NoContent();
                    }
                    catch
                    {

                    }
                }
            }
            return NoContent();
        }

        // End Old Code
    }
}
