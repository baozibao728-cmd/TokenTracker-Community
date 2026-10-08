using System.Runtime.CompilerServices;
using TokenTrackerWin;
using Xunit;

namespace TokenTrackerWin.Tests;

public sealed class WindowsReleaseIdentityTests
{
    [Fact]
    public void InstallerUsesAnIndependentUpgradeIdentityAndExecutable()
    {
        var setup = ReadWindowsFile("installer/TokenTracker.iss");
        var project = ReadWindowsFile("TokenTrackerWin.csproj");

        Assert.Contains("AppId={{638F4DBF-F2B4-4408-B654-5A5D0F5B7AC7}", setup);
        Assert.DoesNotContain("8F2A6C71-4E9D-4B7A-9C3E-1D5F0A2B6E84", setup);
        Assert.Equal("TokenOrbit", Constants.AppDisplayName);
        Assert.Contains("#define MyAppName \"TokenOrbit\"", setup);
        Assert.Contains("#define MyAppPublisher \"baozibao728-cmd\"", setup);
        Assert.Contains($"#define MyAppExeName \"{Constants.AppExeName}\"", setup);
        Assert.Contains("DefaultDirName={localappdata}\\Programs\\TokenTrackerCommunity", setup);
        Assert.Contains("OutputBaseFilename=TokenTracker-Community-Setup-v{#MyAppVersion}", setup);
        Assert.Contains("Type: filesandordirs; Name: \"{app}\\EmbeddedServer\\tokentracker\\dashboard\\dist\"", setup);
        Assert.Contains("<AssemblyName>TokenTrackerCommunity</AssemblyName>", project);
        Assert.Contains("<Product>TokenOrbit</Product>", project);
        Assert.Contains($"<Company>{Constants.PublisherName}</Company>", project);
    }

    [Fact]
    public void RuntimeAndUpdateResourcesDoNotClaimTheOfficialProduct()
    {
        var officialData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TokenTracker");
        var officialCliData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".tokentracker");

        Assert.NotEqual(officialData, Constants.DataDirectory);
        Assert.NotEqual(officialCliData, Constants.CliDataRoot);
        Assert.Equal("tokentracker-community", Constants.UrlScheme);
        Assert.Equal("TokenTrackerCommunity", Constants.StartupRegistryValueName);
        Assert.Equal("baozibao728-cmd/TokenTracker-Community", Constants.GitHubRepo);
        Assert.Equal("TokenTracker-Community-Setup.exe", Constants.SetupAssetName);
        Assert.Equal(17681, Constants.PreferredOAuthPort);

        Assert.Contains("Constants.SingleInstanceMutexName", ReadWindowsFile("Program.cs"));
        Assert.Contains("Constants.DeepLinkPipeName", ReadWindowsFile("SingleInstance.cs"));
        Assert.Contains("Constants.UrlScheme", ReadWindowsFile("UrlProtocol.cs"));
        Assert.Contains("Constants.StartupRegistryValueName", ReadWindowsFile("LaunchAtStartup.cs"));
        Assert.Contains("psi.Environment[\"TOKENTRACKER_DATA_ROOT\"] = Constants.CliDataRoot", ReadWindowsFile("ServerManager.cs"));
        Assert.Contains("private const string Repo = Constants.GitHubRepo", ReadWindowsFile("UpdateChecker.cs"));
        Assert.Contains("private const string SetupAssetName = Constants.SetupAssetName", ReadWindowsFile("UpdateChecker.cs"));
    }

    [Fact]
    public void LegacyShortcutMigrationRequiresTheExactProductTarget()
    {
        var setup = ReadWindowsFile("installer/TokenTracker.iss");
        Assert.Contains("Shortcut.TargetPath", setup);
        Assert.Contains("CompareText(ExpandFileName(Target)", setup);
        Assert.Contains("ExpandFileName(ExpandConstant('{app}\\{#MyAppExeName}')))", setup);
        Assert.Contains("{userprograms}\\TokenTracker Community.lnk", setup);
        Assert.Contains("{userdesktop}\\TokenTracker Community.lnk", setup);
        Assert.Contains("Check: ShouldCreateDesktopShortcut", setup);
        Assert.Contains("WizardIsTaskSelected('desktopicon') or IsShortcutForThisInstallation", setup);
        Assert.DoesNotContain("{userprograms}\\TokenTracker.lnk", setup);
        Assert.DoesNotContain("{userdesktop}\\TokenTracker.lnk", setup);
        Assert.DoesNotContain("Name: \"{userdesktop}\\TokenTracker Community\"", setup);
    }

    private static string ReadWindowsFile(string relativePath, [CallerFilePath] string testFile = "")
    {
        var sourceDirectory = Path.GetDirectoryName(testFile)!;
        var path = Path.GetFullPath(Path.Combine(sourceDirectory, "..", "TokenTrackerWin", relativePath));
        return File.ReadAllText(path);
    }

    [Theory]
    [InlineData("https://github.com/baozibao728-cmd/TokenTracker-Community/releases/download/v1.2.0/TokenTracker-Community-Setup.exe", true)]
    [InlineData("https://github.com/baozibao728-cmd/TokenTracker-Community/releases/download/v1.2.0/SHA256SUMS", true)]
    [InlineData("https://github.com/xiufengsun/TokenTracker/releases/download/v1.2.0/TokenTracker-Setup.exe", false)]
    [InlineData("https://github.com.example.com/baozibao728-cmd/TokenTracker-Community/releases/download/v1.2.0/Setup.exe", false)]
    [InlineData("http://github.com/baozibao728-cmd/TokenTracker-Community/releases/download/v1.2.0/Setup.exe", false)]
    public void UpdateAssetsMustBelongToTheCommunityRepository(string url, bool expected)
    {
        Assert.Equal(expected, Constants.IsCommunityReleaseAssetUrl(url));
    }
}
