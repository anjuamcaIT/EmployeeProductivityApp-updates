namespace UserNotificationAPI.Models
{
    public class UserActivity
    {
        public string EmpId { get; set; }
        public string ActivityDate { get; set; }
        public string? ActivityStartTimeDate { get; set; }
        public int ActivityHour { get; set; }
        public int KeyStrokeCount { get; set; }
        public int IdleMinutes { get; set; }
        public int CreatedBy { get; set; }
        public string HostName { get; set; } 
        public string? HourActivityStartTimeDate { get; set; }
        public string? Screenshotimg { get; set; }
        public string? FirstActiveTimeDate { get; set; }
        public string? LastActiveTimeDate { get; set; } 
        public string? IdlePeriods { get; set; }
        public string? IdlePeriodsXML { get; set; }
    } 
    public class ScreenshotSettings
    {
        public bool Enabled { get; set; }
        public int IntervalMinutes { get; set; } // interval in minutes
    }
    public class UserOTP
    {
        public string OTPCode { get; set; }
        public int OTPSecs { get; set; } // interval in minutes
    }

    public class ScreenshotUpload
    {
        public string EmpId { get; set; }
        public string Timestamp { get; set; }  
        public string ScreenshotImg { get; set; }  
    }

    public class IdlePeriod
    {
        public string start { get; set; }
        public string end { get; set; }
        public string durationMinutes { get; set; }
    }

    public class SecurityKeyResponse
    {
        public bool IsValid { get; set; }
        public string Message { get; set; }
    }

    public class DeviceHeartbeat
    {
        public string EmpId { get; set; }
        public string? HostName { get; set; }
        public string? MacAddress { get; set; }
        public string? DeviceId { get; set; }
        public string? OS { get; set; }
        public string? TimeZone { get; set; }
        public DateTime? LastHeartbeat { get; set; }
    }

}
