using System.Runtime.CompilerServices;
using TokenTrackerWin;
using Xunit;

namespace TokenTrackerWin.Tests;

public sealed class OAuthDiagnosticsTests
{
    private const string Code = "SYNTHETIC_AUTH_CODE_SENTINEL";
    private const string Token = "SYNTHETIC_ACCESS_TOKEN_SENTINEL";
    private const string UserInfo = "SYNTHETIC_USERINFO_SENTINEL";

    [Theory]
    [InlineData("https", "tc79bxhm.ap-southeast.insforge.app", "/api/auth/oauth/google", "")]
    [InlineData("http", "127.0.0.1", "/auth/callback", ":17681")]
    [InlineData("tokentracker-community", "auth", "/callback", "")]
    public void NavigationEmitsOnlySafeEndpointWithoutChangingTheInput(string scheme, string host, string path, string port)
    {
        var url = $"{scheme}://{UserInfo}:{Token}@{host}{port}{path}?insforge_code={Code}&access_token={Token}#refresh_token={Token}";
        var original = url;
        var output = new List<string>();
        OAuthDiagnostics.Navigation("dashboard", "oauth navigation", url, (component, message) => output.Add($"[{component}] {message}"));

        Assert.Equal($"[dashboard] oauth navigation endpoint={scheme}://{host}{port}{path}", Assert.Single(output));
        AssertAbsentSentinels(output);
        Assert.DoesNotContain("?", output[0]);
        Assert.DoesNotContain("#", output[0]);
        Assert.DoesNotContain("@", output[0]);
        // Logging has no return URL to substitute into the real navigation/exchange.
        Assert.Same(original, url);
        Assert.Equal(Code, Uri.UnescapeDataString(new Uri(url).Query.Split('&')[0].Split('=')[1]));
    }

    [Theory]
    [InlineData("query")]
    [InlineData("fragment")]
    [InlineData("invalid")]
    [InlineData("relative")]
    [InlineData("unsupported")]
    [InlineData("null")]
    public void URLShapesCannotFallBackToRawCredentialLogging(string shape)
    {
        string? url = shape switch
        {
            "query" => $"https://example.invalid/auth/callback?insforge_code={Code}",
            "fragment" => $"https://example.invalid/auth/callback#access_token={Token}",
            "invalid" => $"https://[invalid-host/{Code}?access_token={Token}",
            "relative" => $"/auth/callback?insforge_code={Code}#access_token={Token}",
            "unsupported" => $"file:///auth/callback?insforge_code={Code}#access_token={Token}",
            _ => null
        };
        var output = new List<string>();
        OAuthDiagnostics.Navigation("tray", "callback received", url, (_, message) => output.Add(message));

        var endpoint = shape is "query" or "fragment" ? "https://example.invalid/auth/callback" : "<unavailable>";
        Assert.Equal($"callback received endpoint={endpoint}", Assert.Single(output));
        AssertAbsentSentinels(output);
    }

    [Fact]
    public void FailureDoesNotEmitMessageInnerExceptionDataOrStackTrace()
    {
        var error = new InvalidOperationException($"https://example.invalid/callback?insforge_code={Code}",
            new Exception($"#access_token={Token}"));
        error.Data["request"] = $"https://{UserInfo}@example.invalid/?token={Token}";
        var output = new List<string>();
        OAuthDiagnostics.Failure("program", "navigation failed", error, (component, message) => output.Add($"[{component}] {message}"));

        Assert.Equal($"[program] navigation failed errorType=InvalidOperationException hresult=0x{error.HResult:X8}", Assert.Single(output));
        AssertAbsentSentinels(output);
        Assert.DoesNotContain("https://", output[0]);
    }

    [Fact]
    public void UnhandledExceptionObjectCannotLeakThroughToString()
    {
        var output = new List<string>();
        OAuthDiagnostics.Failure("program", "unhandled callback", new UntrustedError(), (_, message) => output.Add(message));
        Assert.Equal("unhandled callback errorType=UntrustedError", Assert.Single(output));
        AssertAbsentSentinels(output);
    }

    private sealed class UntrustedError
    {
        public override string ToString() => throw new InvalidOperationException($"{Code} {Token}");
    }

    [Fact]
    public void EveryNativeOAuthLogEntryUsesSafeFormattingWhileForwardingOriginalValues()
    {
        var program = ReadWindowsFile("Program.cs");
        var dashboard = ReadWindowsFile("DashboardWindow.cs");
        var tray = ReadWindowsFile("TrayApplicationContext.cs");

        Assert.Contains("hasDeepLink={deepLink is not null}", program);
        Assert.DoesNotContain("deepLink={(deepLink", program);
        Assert.Contains("SingleInstance.TryForwardToPrimary(deepLink)", program);
        Assert.Contains("return a;", program);
        Assert.Contains("OAuthDiagnostics.Navigation(\"tray\", \"HandleDeepLink received\", url)", tray);
        Assert.Contains("var uri = new Uri(url)", tray);
        Assert.Contains("code = Uri.UnescapeDataString(raw)", tray);
        Assert.Contains("_dashboard!.HandleAuthCallback(resolved)", tray);
        Assert.DoesNotContain("RefreshSummary failed: {ex}", tray);
        foreach (var eventName in new[] { "nav starting", "nav completed", "history changed", "oauth open" })
            Assert.Contains($"OAuthDiagnostics.Navigation(\"dashboard\", \"{eventName}\",", dashboard);
        Assert.Contains("OpenInBrowser(e.Uri)", dashboard);
        Assert.Contains("OpenInBrowser(url)", dashboard);
        Assert.Contains("var encoded = Uri.EscapeDataString(code)", dashboard);
        Assert.Contains("NavigateWhenServerReady($\"/auth/callback?insforge_code={encoded}&app=1\")", dashboard);
        foreach (var source in new[] { program, dashboard })
        {
            Assert.DoesNotContain("{ex.Message}", source);
            Assert.DoesNotContain("{e.Exception}", source);
            Assert.DoesNotContain("{ex}", source);
        }
    }

    private static void AssertAbsentSentinels(IEnumerable<string> output)
    {
        foreach (var message in output)
            foreach (var sentinel in new[] { Code, Token, UserInfo })
                Assert.DoesNotContain(sentinel, message);
    }

    private static string ReadWindowsFile(string relativePath, [CallerFilePath] string testFile = "") =>
        File.ReadAllText(Path.GetFullPath(Path.Combine(Path.GetDirectoryName(testFile)!, "..", "TokenTrackerWin", relativePath)));
}
