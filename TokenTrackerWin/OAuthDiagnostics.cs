namespace TokenTrackerWin;

/// <summary>Diagnostics for native OAuth/navigation; never log credentials from URLs or exceptions.</summary>
internal static class OAuthDiagnostics
{
    public static void Navigation(string component, string eventName, string? url,
        Action<string, string>? write = null)
    {
        // Formatting is for diagnostics only. Callers keep using the original URL.
        (write ?? Diag.Log)(component, $"{eventName} endpoint={SafeEndpoint(url)}");
    }

    public static void Failure(string component, string eventName, object? error,
        Action<string, string>? write = null)
    {
        // Exception.Message/ToString/InnerException can include a full callback URL.
        var errorCode = error is Exception ex ? $" hresult=0x{ex.HResult:X8}" : "";
        (write ?? Diag.Log)(component, $"{eventName} errorType={error?.GetType().Name ?? "none"}{errorCode}");
    }

    internal static string SafeEndpoint(string? url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || string.IsNullOrEmpty(uri.Host)
            || uri.Scheme is not ("http" or "https" or Constants.UrlScheme))
            return "<unavailable>";

        // SchemeAndServer excludes UserInfo; no query/fragment and no raw-string fallback.
        return uri.GetComponents(UriComponents.SchemeAndServer | UriComponents.Path, UriFormat.UriEscaped);
    }
}
