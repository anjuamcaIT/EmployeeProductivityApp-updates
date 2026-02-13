namespace UserNotificationAPI.Models
{
    public class Notification
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Body { get; set; }
        public string IsSeen { get; set; }
        public string SentTime { get; set; }
        public string CreatedDate { get; set; }
    }

}
