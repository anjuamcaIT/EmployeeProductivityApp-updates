namespace UserNotificationAPI
{
    public interface IConfigurationService
    {
        string GetConnectionString();
        string GetJwtKey();
    }

    public class ConfigurationService : IConfigurationService
    {
        private readonly IConfiguration _configuration;

        public ConfigurationService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GetConnectionString()
        {
            return _configuration.GetConnectionString("erpconstr") + ";TrustServerCertificate=True";
        }

        public string GetJwtKey()
        {
            return _configuration["Jwt:Key"]; 
        }
    }
}
