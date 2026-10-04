"use strict";

const path = require("node:path");

// Each scan test owns all provider inputs and Community outputs. Never inherit
// the agent harness's real CODEX_HOME, tokens, config or Windows app-data paths.
function withCommunityHome(home) {
  const keys = new Set(Object.keys(process.env).filter((key) =>
    /^(TOKENTRACKER_|CODEX_|CLAUDE_|CODE_HOME$|GEMINI_|OPENCODE_|OPENCLAW_|DSH_|KIRO_|KILO_|AMP_|GROK_|XDG_|HOME$|USERPROFILE$|APPDATA$|LOCALAPPDATA$)/i.test(key)));
  const values = {
    HOME: home, USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(home, "AppData", "Local"),
    XDG_DATA_HOME: path.join(home, ".local", "share"),
    XDG_CONFIG_HOME: path.join(home, ".config"),
    CODEX_HOME: path.join(home, ".codex"),
    CLAUDE_CONFIG_DIR: path.join(home, ".claude"),
    CODE_HOME: path.join(home, ".code"),
    GEMINI_HOME: path.join(home, ".gemini"),
    OPENCODE_HOME: path.join(home, ".opencode"),
    TOKENTRACKER_DATA_ROOT: path.join(home, ".tokentracker-community"),
    TOKENTRACKER_WSL_MODE: "native-only",
    TOKENTRACKER_AUTO_RETRY_NO_SPAWN: "1",
  };
  for (const key of Object.keys(values)) keys.add(key);
  const saved = Object.fromEntries([...keys].map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, values);
  return () => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  };
}

module.exports = { withCommunityHome };
