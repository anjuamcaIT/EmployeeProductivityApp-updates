namespace UserNotificationAPI.Models
{
    public class User
    {
        public string? UserId { get; set; }
        public string? SecurityKey { get; set; }
        public string? Password { get; set; }
        public string? HostName { get; set; }
        public string? MacAddress { get; set; }
        public string? RegisteredDateTime { get; set; }
        public string? RegisterdTimeZone { get; set; }
        public string? DeviceId { get; set; }
        public string? OS { get; set; }
    }

    public class RefreshToken
    {
        public string Token { get; set; }
        public string UserId { get; set; }
        public DateTime ExpiryDate { get; set; }
    }


}
