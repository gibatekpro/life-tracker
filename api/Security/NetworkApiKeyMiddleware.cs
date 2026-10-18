using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace LifeTracker.Api.Security;

public class NetworkApiKeyMiddleware(
    RequestDelegate next,
    IConfiguration config,
    ILogger<NetworkApiKeyMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var remote = context.Connection.RemoteIpAddress;
        if (remote is not null && remote.IsIPv4MappedToIPv6)
            remote = remote.MapToIPv4();

        // Requests from this Mac (the dashboard, Scalar) don't need a key.
        if (remote is not null && IPAddress.IsLoopback(remote))
        {
            await next(context);
            return;
        }

        var expected = config["Security:ApiKey"];
        var provided = context.Request.Headers["X-Api-Key"].ToString();

        if (string.IsNullOrEmpty(expected) ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(provided),
                Encoding.UTF8.GetBytes(expected)))
        {
            logger.LogWarning("Rejected {Method} {Path} from {Ip}: missing or wrong API key",
                context.Request.Method, context.Request.Path, remote);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await next(context);
    }
}