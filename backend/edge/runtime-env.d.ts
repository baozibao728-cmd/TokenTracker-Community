// Local compiler declaration only; runtime values come from InsForge Edge env.
declare namespace Deno {
  const env: { get(name: string): string | undefined };
}
