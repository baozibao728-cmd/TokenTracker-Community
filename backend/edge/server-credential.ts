// Source template inlined into every generated single-file MVP Edge entry.
// Read only project credentials injected by InsForge Edge Runtime.
// Never use request headers, ANON_KEY, CLI credentials or local configuration.
export function resolveServerCredential(): string | undefined {
  return Deno.env.get("INSFORGE_SERVICE_ROLE_KEY")?.trim()
    || Deno.env.get("API_KEY")?.trim()
    || undefined;
}
