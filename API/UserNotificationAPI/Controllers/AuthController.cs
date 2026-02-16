 using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.Data.SqlClient;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims; 
using System.Text;
using UserNotificationAPI.Models;

namespace UserNotificationAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfigurationService _configurationService;
        public AuthController(IConfigurationService configurationService)
        {
            _configurationService = configurationService;
        } 

        [HttpPost("login")]
        public IActionResult Login([FromBody] User user)
        {
            string connectionString = _configurationService.GetConnectionString();

            using (SqlConnection con = new SqlConnection(connectionString))
            {
                using (SqlCommand cmd = new SqlCommand("GetUserNotificationData", con))
                {
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.Parameters.AddWithValue("@UserId", user.UserId);
                    cmd.Parameters.AddWithValue("@SecurityKey", user.SecurityKey);
                    cmd.Parameters.AddWithValue("@Password", user.Password); 
                    cmd.Parameters.AddWithValue("@HostName", user.HostName);
                    cmd.Parameters.AddWithValue("@MacAddress", user.MacAddress);
                    cmd.Parameters.AddWithValue("@RegisteredDateTime", user.RegisteredDateTime);
                    cmd.Parameters.AddWithValue("@RegisterdTimeZone", user.RegisterdTimeZone);
                    cmd.Parameters.AddWithValue("@DeviceId", user.DeviceId);
                    cmd.Parameters.AddWithValue("@OS", user.OS);
                    cmd.Parameters.AddWithValue("@OpCode", 1);
                    con.Open();
                    using (SqlDataReader reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            string uid = reader["Autoid"].ToString();
                            string employeeName = reader["Name"].ToString();
                            string employeeId = reader["EmployeeId"].ToString();
                            string department = reader["Department"].ToString();
                            string designation = reader["Designation"].ToString();
                            string profilepic = reader["PortalProfile"].ToString();
                            string authSecuritykey = reader["AuthSecuritykey"].ToString();
                            string password = reader["UserPasswd"].ToString();
                            var tokenHandler = new JwtSecurityTokenHandler();
                            var key = Encoding.ASCII.GetBytes(_configurationService.GetJwtKey()); 

                            var tokenDescriptor = new SecurityTokenDescriptor
                            {
                                Subject = new ClaimsIdentity(new Claim[]
                                {
                                      //new Claim(ClaimTypes.Name, user.UserId)  
                                      new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                                      new Claim(ClaimTypes.Name, employeeName)
                                }),
                                Expires = DateTime.UtcNow.AddDays(1),
                                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
                            };

                            var token = tokenHandler.CreateToken(tokenDescriptor);
                            reader.Close();
                            using (SqlCommand cmdInsert = new SqlCommand("GetUserNotificationData", con))
                            {
                                cmdInsert.CommandType = CommandType.StoredProcedure;
                                cmdInsert.Parameters.AddWithValue("@UserId", user.UserId);
                                cmdInsert.Parameters.AddWithValue("@SecurityKey", user.SecurityKey);
                                cmdInsert.Parameters.AddWithValue("@Password", user.Password);
                                cmdInsert.Parameters.AddWithValue("@HostName", user.HostName);
                                cmdInsert.Parameters.AddWithValue("@MacAddress", user.MacAddress);
                                cmdInsert.Parameters.AddWithValue("@RegisteredDateTime", user.RegisteredDateTime);
                                cmdInsert.Parameters.AddWithValue("@RegisterdTimeZone", user.RegisterdTimeZone);
                                cmdInsert.Parameters.AddWithValue("@DeviceId", user.DeviceId);
                                cmdInsert.Parameters.AddWithValue("@OS", user.OS);
                                cmdInsert.Parameters.AddWithValue("@OpCode", 11);  

                                cmdInsert.ExecuteNonQuery();
                            }
                            return Ok(new
                            {
                                success = true,
                                token = tokenHandler.WriteToken(token),
                                employeeDetails = new
                                {
                                    UID = uid,
                                    Name = employeeName,
                                    ID = employeeId,
                                    Department = department,
                                    Designation = designation,
                                    Profilepic = profilepic,
                                    Password = password,
                                    AuthSecuritykey = authSecuritykey 
                                }
                            }); 
                        }
                        else
                        {
                            return Unauthorized(); 
                        }
                    }
                }
            }
        }

    }
}
