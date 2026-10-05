"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { withHome } = require("./helpers/with-home");
const { createLocalApiHandler } = require("../src/lib/local-api");
const { __resetCloudAccountCacheForTests } = require("../src/lib/cloud-account");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function response(body = {}, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", ...headers },
  });
}

async function call(handler, endpoint, { method = "GET", body, headers = {} } = {}) {
  const req = Readable.from(body == null ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.headers = headers;
  const res = {
    statusCode: null, headers: {}, body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(status, values) {
      this.statusCode = status;
      for (const [name, value] of Object.entries(values || {})) this.setHeader(name, value);
    },
    end(value) { this.body = value == null ? "" : Buffer.from(value).toString(); },
  };
  assert.equal(await handler(req, res, new URL(endpoint, "http://localhost")), true);
  return res;
}

async function withRelay(run) {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), "tt-logout-boundary-"));
  const restoreHome = withHome(home);
  const envNames = ["TOKENTRACKER_DATA_ROOT", "TOKENTRACKER_INSFORGE_BASE_URL",
    "TOKENTRACKER_INSFORGE_ANON_KEY", "TOKENTRACKER_NO_TELEMETRY"];
  const savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  try {
    const dataRoot = path.join(home, "community-data");
    process.env.TOKENTRACKER_DATA_ROOT = dataRoot;
    process.env.TOKENTRACKER_INSFORGE_BASE_URL = "https://example.invalid";
    process.env.TOKENTRACKER_INSFORGE_ANON_KEY = "fixture-anon";
    process.env.TOKENTRACKER_NO_TELEMETRY = "1";
    __resetCloudAccountCacheForTests();
    const cookiePath = path.join(dataRoot, "tracker", "relay-cookies.json");
    fs.mkdirSync(path.dirname(cookiePath), { recursive: true });
    fs.writeFileSync(cookiePath, JSON.stringify({
      insforge_refresh_token: "insforge_refresh_token=fixture-before-logout; Path=/; HttpOnly",
    }));
    const queuePath = path.join(home, "queue.jsonl");
    fs.writeFileSync(queuePath, "");
    const handler = createLocalApiHandler({ queuePath });
    await run({ handler, cookiePath, queuePath, home });
  } finally {
    globalThis.fetch = originalFetch;
    __resetCloudAccountCacheForTests();
    for (const name of envNames) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
    restoreHome();
    await fsp.rm(home, { recursive: true, force: true });
  }
}

async function assertSignedOut(handler, cookiePath) {
  const prefs = JSON.parse((await call(handler, "/functions/tokentracker-cloud-sync-pref")).body);
  assert.equal(prefs.account_available, false, "in-memory relay must be unavailable");
  assert.equal(fs.existsSync(cookiePath), false, "persisted relay must be removed");
}

test("POST logout 403 clears relay memory and disk without hiding upstream status or body", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const body = '{"code":"FIXTURE_LOGOUT_DENIED"}';
    let outboundCookie;
    globalThis.fetch = async (_url, options) => {
      outboundCookie = options.headers.cookie;
      return new Response(body, { status: 403, headers: { "content-type": "application/json" } });
    };
    const res = await call(handler, "/api/auth/logout", { method: "POST" });
    assert.match(outboundCookie, /fixture-before-logout/, "forward the old session for remote revocation");
    assert.equal(res.statusCode, 403);
    assert.equal(res.body, body);
    await assertSignedOut(handler, cookiePath);
    assert.equal(res.headers["x-tokentracker-local-logout"], "cleared");
  });
});

test("POST logout 2xx deleting the last cookie still removes the persisted file", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    globalThis.fetch = async () => response({ ok: true }, 200, {
      "set-cookie": "insforge_refresh_token=; Path=/; Max-Age=0; HttpOnly",
    });
    const res = await call(handler, "/api/auth/logout", { method: "POST" });
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["set-cookie"], /Max-Age=0/);
    await assertSignedOut(handler, cookiePath);
  });
});

test("POST logout removes a disk session even when an earlier response emptied the relay map", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    globalThis.fetch = async () => response({}, 200, {
      "set-cookie": "insforge_refresh_token=; Path=/; Max-Age=0",
    });
    await call(handler, "/api/auth/session");
    assert.equal(JSON.parse((await call(handler, "/functions/tokentracker-cloud-sync-pref")).body).account_available, false);
    assert.equal(fs.existsSync(cookiePath), true, "ordinary empty-map sticky semantics are unchanged");
    globalThis.fetch = async () => response({ code: "FIXTURE_LOGOUT_DENIED" }, 403);
    await call(handler, "/api/auth/logout", { method: "POST" });
    await assertSignedOut(handler, cookiePath);
  });
});

test("a foreign browser origin cannot establish a local logout boundary", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const original = fs.readFileSync(cookiePath, "utf8");
    let calls = 0;
    globalThis.fetch = async () => { calls++; return response({ ok: true }); };
    const res = await call(handler, "/api/auth/logout", {
      method: "POST", headers: { origin: "https://untrusted.invalid" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(calls, 0);
    assert.equal(fs.readFileSync(cookiePath, "utf8"), original);
  });
});

test("a pre-logout auth refresh cannot write cookies or tokens back after the logout boundary", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const started = deferred();
    const release = deferred();
    const logoutStarted = deferred();
    const releaseLogout = deferred();
    globalThis.fetch = async (url) => {
      if (new URL(url).pathname === "/api/auth/refresh") {
        started.resolve();
        await release.promise;
        return response({ accessToken: "fixture-old-access", refreshToken: "fixture-late-refresh" }, 200, {
          "set-cookie": "insforge_refresh_token=fixture-late-cookie; Path=/; HttpOnly",
        });
      }
      logoutStarted.resolve();
      await releaseLogout.promise;
      return response({ code: "FIXTURE_LOGOUT_DENIED" }, 403);
    };
    const pending = call(handler, "/api/auth/refresh", { method: "POST" });
    await started.promise;
    const logout = call(handler, "/api/auth/logout", { method: "POST" });
    await logoutStarted.promise;
    release.resolve();
    const stale = await pending;
    releaseLogout.resolve();
    await logout;
    assert.equal(stale.statusCode, 409);
    assert.equal(JSON.parse(stale.body).error, "AUTH_SESSION_SUPERSEDED");
    assert.equal(stale.headers["set-cookie"], undefined);
    assert.doesNotMatch(stale.body, /fixture-old-access|fixture-late/);
    await assertSignedOut(handler, cookiePath);
  });
});

test("ordinary Auth 403 retains the existing valid relay; GET logout does not establish a boundary", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const original = fs.readFileSync(cookiePath, "utf8");
    globalThis.fetch = async () => response({ code: "FIXTURE_DENIED" }, 403, {
      "set-cookie": "insforge_refresh_token=; Path=/; Max-Age=0",
    });
    for (const [endpoint, method] of [["/api/auth/session", "POST"], ["/api/auth/logout", "GET"]]) {
      const res = await call(handler, endpoint, { method });
      assert.equal(res.statusCode, 403);
      assert.equal(fs.readFileSync(cookiePath, "utf8"), original);
      const prefs = JSON.parse((await call(handler, "/functions/tokentracker-cloud-sync-pref")).body);
      assert.equal(prefs.account_available, true);
    }
  });
});

test("a legitimate new login after logout persists normally and stays distinct from stale refresh", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    fs.writeFileSync(path.join(path.dirname(cookiePath), "cloud-sync-pref.json"), '{"enabled":false}');
    const started = deferred();
    const release = deferred();
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/auth/refresh") {
        started.resolve();
        await release.promise;
        return response({ refreshToken: "fixture-stale-user" });
      }
      if (pathname === "/api/auth/logout") return response({ ok: true });
      return response({ refreshToken: "fixture-new-user", csrfToken: "fixture-new-csrf" });
    };
    const pending = call(handler, "/api/auth/refresh", { method: "POST" });
    await started.promise;
    await call(handler, "/api/auth/logout", { method: "POST" });
    await call(handler, "/api/auth/sessions", { method: "POST" });
    release.resolve();
    assert.equal((await pending).statusCode, 409);
    const saved = JSON.parse(fs.readFileSync(cookiePath, "utf8"));
    assert.match(saved.insforge_refresh_token, /=fixture-new-user;/);
    assert.match(saved.insforge_csrf_token, /=fixture-new-csrf;/);
    const prefs = JSON.parse((await call(handler, "/functions/tokentracker-cloud-sync-pref")).body);
    assert.equal(prefs.account_available, true);
    assert.equal(prefs.enabled, false, "new login must preserve the disabled cloud-sync preference");
  });
});

test("a failed disk cleanup remains observable while preserving an upstream logout 403", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const unlink = fs.unlinkSync;
    const logError = console.error;
    fs.unlinkSync = (target) => {
      if (target === cookiePath) throw Object.assign(new Error("fixture cleanup failed"), { code: "EACCES" });
      return unlink(target);
    };
    console.error = () => {};
    try {
      const body = '{"code":"FIXTURE_LOGOUT_DENIED"}';
      globalThis.fetch = async () => new Response(body, { status: 403 });
      const res = await call(handler, "/api/auth/logout", { method: "POST" });
      assert.equal(res.statusCode, 403);
      assert.equal(res.body, body);
      assert.equal(res.headers["x-tokentracker-local-logout"], "failed");
      assert.equal(fs.existsSync(cookiePath), true);
    } finally { fs.unlinkSync = unlink; console.error = logError; }
  });
});

test("persistent logout cleanup failure is observable and is not reported as successful local logout", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const unlink = fs.unlinkSync;
    const logError = console.error;
    const errors = [];
    fs.unlinkSync = (target) => {
      if (target === cookiePath) throw Object.assign(new Error("fixture cleanup failed"), { code: "EACCES" });
      return unlink(target);
    };
    console.error = (...args) => errors.push(args.join(" "));
    try {
      globalThis.fetch = async () => response({ ok: true });
      const res = await call(handler, "/api/auth/logout", { method: "POST" });
      assert.equal(res.statusCode, 502);
      assert.equal(JSON.parse(res.body).error, "LOCAL_LOGOUT_PERSISTENCE_FAILED");
      assert.equal(res.headers["x-tokentracker-local-logout"], "failed");
      assert.equal(fs.existsSync(cookiePath), true, "cannot claim a failed disk deletion succeeded");
      assert.equal(JSON.parse((await call(handler, "/functions/tokentracker-cloud-sync-pref")).body).account_available, false);
      assert.ok(errors.some((line) => line.includes("EACCES")));
    } finally { fs.unlinkSync = unlink; console.error = logError; }
  });
});

test("new handler and new process on the same data directory cannot restore the logged-out account", async () => {
  await withRelay(async ({ handler, cookiePath, queuePath }) => {
    globalThis.fetch = async () => response({ code: "FIXTURE_LOGOUT_DENIED" }, 403);
    await call(handler, "/api/auth/logout", { method: "POST" });
    const next = createLocalApiHandler({ queuePath });
    await assertSignedOut(next, cookiePath);
    const code = `
      const { createLocalApiHandler } = require('./src/lib/local-api');
      globalThis.fetch = () => { throw new Error('Unexpected network call'); };
      const h = createLocalApiHandler({queuePath:process.argv[1]});
      const req = {method:'GET',headers:{}};
      const res = {writeHead(){},end(body){console.log(body)}};
      h(req,res,new URL('http://localhost/functions/tokentracker-cloud-sync-pref'));
    `;
    const output = execFileSync(process.execPath, ["-e", code, queuePath], {
      cwd: path.resolve(__dirname, ".."), env: { ...process.env }, encoding: "utf8", timeout: 10000,
    });
    const prefs = JSON.parse(output.trim().split(/\r?\n/).at(-1));
    assert.equal(prefs.account_available, false);
  });
});

test("pre-logout account-view rotation cannot restore relay or serve the old cloud account", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const started = deferred();
    const release = deferred();
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/auth/logout") return response({ ok: true });
      if (pathname === "/api/auth/refresh") {
        started.resolve();
        await release.promise;
        return response({ accessToken: "fixture-account-access", refreshToken: "fixture-account-rotated" });
      }
      return response({ totals: { total_tokens: "999" } });
    };
    const pending = call(handler, "/functions/tokentracker-usage-summary?account=1&from=2026-10-04&to=2026-10-04&tz=UTC");
    await started.promise;
    await call(handler, "/api/auth/logout", { method: "POST" });
    release.resolve();
    const res = await pending;
    assert.equal(res.headers["x-tokentracker-account-view"], "0");
    assert.equal(res.headers["x-tokentracker-account-fallback"], "signed-out");
    assert.doesNotMatch(res.body, /999/);
    await assertSignedOut(handler, cookiePath);
  });
});

test("pre-logout local-sync token rotation cannot persist relay or hand a token to the sync child", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const started = deferred();
    const release = deferred();
    let issueCalls = 0;
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/auth/logout") return response({ ok: true });
      if (pathname === "/api/auth/refresh") {
        started.resolve();
        await release.promise;
        return response({ accessToken: "fixture-sync-access", refreshToken: "fixture-sync-rotated" });
      }
      if (pathname.includes("device-token-issue")) { issueCalls++; return response({ token: "fixture-device-token" }); }
      throw new Error("Unexpected network path");
    };
    const { token } = JSON.parse((await call(handler, "/api/local-auth")).body);
    const pending = call(handler, "/functions/tokentracker-local-sync", {
      method: "POST", body: { drain: true }, headers: { "x-tokentracker-local-auth": token },
    });
    await started.promise;
    await call(handler, "/api/auth/logout", { method: "POST" });
    release.resolve();
    const res = await pending;
    assert.equal(res.statusCode, 502, "drain must stop before spawning a cloud sync");
    assert.equal(issueCalls, 0);
    await assertSignedOut(handler, cookiePath);
  });
});

test("a device-token response arriving after logout cannot be handed to the sync child", async () => {
  await withRelay(async ({ handler, cookiePath }) => {
    const started = deferred();
    const release = deferred();
    globalThis.fetch = async (url) => {
      const pathname = new URL(url).pathname;
      if (pathname === "/api/auth/logout") return response({ ok: true });
      if (pathname === "/api/auth/refresh") return response({ accessToken: "fixture-sync-access", refreshToken: "fixture-rotated" });
      started.resolve();
      await release.promise;
      return response({ token: "fixture-late-device-token" });
    };
    const { token } = JSON.parse((await call(handler, "/api/local-auth")).body);
    const pending = call(handler, "/functions/tokentracker-local-sync", {
      method: "POST", body: { drain: true }, headers: { "x-tokentracker-local-auth": token },
    });
    await started.promise;
    await call(handler, "/api/auth/logout", { method: "POST" });
    release.resolve();
    const res = await pending;
    assert.equal(res.statusCode, 502);
    await assertSignedOut(handler, cookiePath);
  });
});
