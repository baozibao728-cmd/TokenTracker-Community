using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TokenTrackerWin;
using Xunit;

namespace TokenTrackerWin.Tests;

public sealed class UpdateInstallGateTests
{
    [Theory]
    [InlineData("missing_asset", false)]
    [InlineData("missing_entry", false)]
    [InlineData("empty", false)]
    [InlineData("malformed", false)]
    [InlineData("mismatch", false)]
    [InlineData("fetch_http_error", false)]
    [InlineData("fetch_exception", false)]
    [InlineData("fetch_timeout", false)]
    [InlineData("matching", true)]
    public async Task ActualDownloadAndInstallOnlyLaunchesAfterChecksumVerification(string scenario, bool allowed)
    {
        var directory = Path.Combine(Path.GetTempPath(), $"community-install-gate-{Guid.NewGuid():N}");
        var launches = 0;
        var quits = 0;
        var integrityFailures = 0;
        using var handler = new ReleaseHandler(scenario);
        using var http = new HttpClient(handler);
        var updater = new UpdateChecker(http, _ => launches++, directory);
        updater.QuitRequested += () => quits++;
        updater.IntegrityCheckFailed += () => integrityFailures++;
        try
        {
            Assert.Equal(UpdateChecker.CheckOutcome.UpdateAvailable, await updater.CheckAsync(silent: false));
            Assert.Equal(allowed, await updater.DownloadAndInstallAsync());
            Assert.Equal(allowed ? 1 : 0, launches);
            Assert.Equal(allowed ? 1 : 0, quits);
            Assert.Equal(allowed ? 0 : 1, integrityFailures);
            Assert.Equal(allowed ? UpdateChecker.UpdateState.Installing : UpdateChecker.UpdateState.UpdateAvailable, updater.State);
            Assert.Equal(allowed ? 1 : 0, Directory.GetFiles(directory).Length);
            Assert.All(handler.Requests, uri => Assert.True(
                uri == $"https://api.github.com/repos/{Constants.GitHubRepo}/releases/latest" ||
                Constants.IsCommunityReleaseAssetUrl(uri)));
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }

    private sealed class ReleaseHandler(string scenario) : HttpMessageHandler
    {
        private static readonly byte[] Payload = Encoding.UTF8.GetBytes("non executable test installer payload");
        private static readonly string AssetRoot = $"https://github.com/{Constants.GitHubRepo}/releases/download/v999.0.0/";
        public List<string> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var uri = request.RequestUri!.AbsoluteUri;
            Requests.Add(uri);
            if (uri.EndsWith("/releases/latest", StringComparison.Ordinal))
            {
                var assets = new List<object>
                {
                    new { name = Constants.SetupAssetName, browser_download_url = AssetRoot + Constants.SetupAssetName, size = Payload.Length }
                };
                if (scenario != "missing_asset")
                    assets.Add(new { name = UpdateIntegrity.ChecksumsAssetName, browser_download_url = AssetRoot + UpdateIntegrity.ChecksumsAssetName, size = 100 });
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(JsonSerializer.Serialize(new { tag_name = "v999.0.0", assets }))
                });
            }
            if (uri.EndsWith(Constants.SetupAssetName, StringComparison.Ordinal))
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(Payload) });
            Assert.EndsWith(UpdateIntegrity.ChecksumsAssetName, uri);
            if (scenario == "fetch_exception") throw new HttpRequestException("test fetch failure");
            if (scenario == "fetch_timeout") throw new TaskCanceledException("test fetch timeout");
            if (scenario == "fetch_http_error") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            var digest = Convert.ToHexString(SHA256.HashData(Payload));
            var body = scenario switch
            {
                "missing_entry" => $"{digest}  different-asset.zip\n",
                "empty" => "",
                "malformed" => $"not-a-sha256  {Constants.SetupAssetName}\n",
                "mismatch" => $"{new string('a', 64)}  {Constants.SetupAssetName}\n",
                _ => $"{digest}  {Constants.SetupAssetName}\n"
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) });
        }
    }
}
