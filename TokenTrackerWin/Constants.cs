using System.IO;

namespace TokenTrackerWin;

/// <summary>
/// Mirror of <c>TokenTrackerBar/Utilities/Constants.swift</c>. The local server
/// port and dashboard URL must match the CLI (<c>tracker serve</c> binds :7680).
/// </summary>
internal static class Constants
{
    // The live server URL is owned by ServerManager — it picks a free loopback
    // port at launch (the CLI default 7680 is unreliable on Windows: Delivery
    // Optimization holds it). Always IPv4 ("127.0.0.1"), never "localhost",
    // which would resolve to ::1 and hit DoSvc on 7680.

    /// <summary>Poll interval for the background health-check loop.</summary>
    public const int HealthCheckIntervalSeconds = 30;

    /// <summary>How long to wait for the server to answer after launch.</summary>
    public const int StartupTimeoutSeconds = 20;

    public const string AppDisplayName = "TokenOrbit";
    public const string AppExeName = "TokenTrackerCommunity.exe";
    public const string PublisherName = "baozibao728-cmd";
    public const string GitHubRepo = "baozibao728-cmd/TokenTracker-Community";
    public const string GitHubUrl = "https://github.com/" + GitHubRepo;
    public const string SetupAssetName = "TokenTracker-Community-Setup.exe";
    public const string SetupFilePrefix = "TokenTracker-Community-Setup-";
    public const string UrlScheme = "tokentracker-community";
    public const string SingleInstanceMutexName = "TokenTrackerCommunity.Windows.Tray.SingleInstance";
    public const string DeepLinkPipeName = "TokenTrackerCommunity.Windows.Tray.DeepLink";
    public const int PreferredOAuthPort = 17681;

    public const string DataDirectoryName = "TokenTrackerCommunity";
    public const string CliDataDirectoryName = ".tokentracker-community";
    public static string DataDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), DataDirectoryName);
    public static string CliDataRoot => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), CliDataDirectoryName);

    /// <summary>HKCU Run-key value name used for launch-at-startup.</summary>
    public const string StartupRegistryValueName = "TokenTrackerCommunity";

    public static bool IsCommunityReleaseAssetUrl(string? value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase)
            && uri.IsDefaultPort && string.IsNullOrEmpty(uri.UserInfo)
            && uri.AbsolutePath.StartsWith("/" + GitHubRepo + "/releases/download/", StringComparison.Ordinal);
    }
}
