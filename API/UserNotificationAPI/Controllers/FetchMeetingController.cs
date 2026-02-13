using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using System.Data;
using UserNotificationAPI.Models;
using System.Text;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;

namespace UserNotificationAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FetchMeetingController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IMemoryCache _memoryCache;

        // Token cache per employee
        private static ConcurrentDictionary<string, (string Token, DateTime Expiry)> _tokenCache = new();

        public FetchMeetingController(IConfigurationService configurationService, IHttpClientFactory httpClientFactory , IMemoryCache memoryCache)
        {
            _configurationService = configurationService;
            _httpClientFactory = httpClientFactory;
            _memoryCache = memoryCache;
        }

        [HttpPost("FetchTeamsCallRecordsToday")]
        public async Task<ActionResult<string>> FetchTeamsCallRecordsToday([FromQuery] string empId)
        {
            if (string.IsNullOrEmpty(empId))
                return BadRequest("Employee ID is required.");

            try
            {
                string userEmail = await GetUserDetails(empId);
                

                string accessToken = await GetAccessToken(empId);
                string userObjectId = await GetUserObjectId(userEmail, accessToken);

                string userTimeZone = await GetUserTimeZone(userEmail, accessToken);
                DateTime todayUtc = DateTime.UtcNow.Date;
                TimeZoneInfo dubaiTimeZone = TimeZoneInfo.FindSystemTimeZoneById(userTimeZone);
                if (string.IsNullOrEmpty(userObjectId))
                    return BadRequest("Cannot find user Object ID.");  
                string graphEndpoint = $"https://graph.microsoft.com/v1.0/communications/callRecords?$filter=participants_v2/any(p:p/id eq '{userObjectId}')";  
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
                client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json")); 

                var response = await client.GetAsync(graphEndpoint);
                string jsonResponse = await response.Content.ReadAsStringAsync(); 
                if (!response.IsSuccessStatusCode)
                    return StatusCode((int)response.StatusCode, $"Error fetching call records: {jsonResponse}"); 
                dynamic callRecords = JsonConvert.DeserializeObject(jsonResponse); 
                if (callRecords?.value == null || callRecords.value.Count == 0)
                    return Ok("<tbl></tbl>"); // No calls today

                var xml = new StringBuilder();
                xml.Append("<tbl>");

                foreach (var callRecord in callRecords.value)
                {
                    DateTime callStartUtc = callRecord.startDateTime;
                    DateTime callEndUtc = callRecord.endDateTime ?? callStartUtc; 
                    if (callStartUtc.Date != todayUtc)
                        continue; 
                    DateTime callStartDubai = TimeZoneInfo.ConvertTimeFromUtc(callStartUtc, dubaiTimeZone);
                    DateTime callEndDubai = TimeZoneInfo.ConvertTimeFromUtc(callEndUtc, dubaiTimeZone); 
                    double durationMinutes = (callEndDubai - callStartDubai).TotalMinutes;  
                    string callType = callRecord.type?.ToString() ?? "Unknown";
                    string callId = callRecord.id?.ToString() ?? "No Call ID"; 
                    xml.Append("<tr>");
                    xml.Append($"<callId><![CDATA[{callId}]]></callId>");
                    xml.Append($"<callType><![CDATA[{callType}]]></callType>");
                    xml.Append($"<ActivityDate><![CDATA[{callEndDubai:yyyy-MM-dd}]]></ActivityDate>");
                    xml.Append($"<startDateTime><![CDATA[{callStartDubai:yyyy-MM-dd HH:mm:ss}]]></startDateTime>");
                    xml.Append($"<endDateTime><![CDATA[{callEndDubai:yyyy-MM-dd HH:mm:ss}]]></endDateTime>");
                    xml.Append($"<durationMinutes><![CDATA[{durationMinutes:F2}]]></durationMinutes>");
                    xml.Append("</tr>");
                } 
                xml.Append("</tbl>");
                string xmlString = xml.ToString();
                using (SqlConnection con = new SqlConnection(_configurationService.GetConnectionString()))
                {
                    await con.OpenAsync();
                    using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.Parameters.AddWithValue("@UserId", empId);
                        cmd.Parameters.AddWithValue("@OpCode", 15);
                        var xmlParam = new SqlParameter("@CallRecordsXml", SqlDbType.Xml)
                        {
                            Value = xmlString
                        };
                        cmd.Parameters.Add(xmlParam);

                        await cmd.ExecuteNonQueryAsync();
                    }
                }
                return Ok(xml.ToString());
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Exception: {ex}");
            }
        }

        private async Task<string> GetAccessToken(string empId)
        {
            if (_tokenCache.TryGetValue(empId, out var cached) && DateTime.UtcNow < cached.Expiry)
                return cached.Token;

            // Fetch credentials from DB
            string tenantId = "", clientId = "", clientSecret = "" ,   useremail = "" ;
            using (SqlConnection con = new SqlConnection(_configurationService.GetConnectionString()))
            {
                await con.OpenAsync();
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", empId);
                    cmd.Parameters.AddWithValue("@OpCode", 13);

                    using (SqlDataReader reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            tenantId = reader["TenantID"].ToString();
                            clientId = reader["ClientID"].ToString();
                            clientSecret = reader["ClientSecret"].ToString(); 
                        }
                        else
                        {
                            throw new Exception("No Graph credentials found for user.");
                        }
                    }
                }
            }

            string tokenEndpoint = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
            var client = _httpClientFactory.CreateClient();
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string,string>("client_id", clientId),
                new KeyValuePair<string,string>("client_secret", clientSecret),
                new KeyValuePair<string,string>("scope","https://graph.microsoft.com/.default"),
                new KeyValuePair<string,string>("grant_type","client_credentials")
            });

            var response = await client.PostAsync(tokenEndpoint, content);
            string result = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Error fetching access token: {result}");

            dynamic tokenResult = JsonConvert.DeserializeObject(result);
            string accessToken = tokenResult.access_token;
            DateTime expiry = DateTime.UtcNow.AddSeconds((int)tokenResult.expires_in - 60); // 60s buffer

            _tokenCache[empId] = (accessToken, expiry);

            return accessToken;
        }

        private async Task<string> GetUserDetails(string empId)
        {
            // Check if cached
            if (_memoryCache.TryGetValue($"UserEmail_{empId}", out string cachedEmail))
                return cachedEmail;

            string userEmail = "";
            using (SqlConnection con = new SqlConnection(_configurationService.GetConnectionString()))
            {
                await con.OpenAsync();
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", empId);
                    cmd.Parameters.AddWithValue("@OpCode", 14);

                    using (SqlDataReader reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            userEmail = reader["office365UserId"].ToString();
                        }
                        else
                        {
                            throw new Exception("No Graph credentials found for user.");
                        }
                    }
                }
            } 
            _memoryCache.Set($"UserEmail_{empId}", userEmail, TimeSpan.FromHours(1)); 
            return userEmail;
        }
         
        private async Task<string> GetUserObjectId(string userEmail, string accessToken)
        {
            string graphEndpoint = $"https://graph.microsoft.com/v1.0/users/{userEmail}";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

            var response = await client.GetAsync(graphEndpoint);
            string json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                throw new Exception($"Error fetching user object ID: {json}");

            dynamic userResult = JsonConvert.DeserializeObject(json);
            return userResult?.id;
        }
         
        private async Task<string> GetUserTimeZone(string userEmail, string accessToken)
        {
            string timeZone = "UTC";
            string graphEndpoint = $"https://graph.microsoft.com/v1.0/users/{userEmail}/mailboxSettings";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
            client.DefaultRequestHeaders.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
            var response = await client.GetAsync(graphEndpoint);
            string json = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
                throw new Exception($"Error fetching user TimeZone: {json}");
            dynamic mailboxSettings = JsonConvert.DeserializeObject(json);
            if (mailboxSettings?.timeZone != null)
            {
                timeZone = mailboxSettings.timeZone.ToString();
            }
            return timeZone;
        }
    }
}
