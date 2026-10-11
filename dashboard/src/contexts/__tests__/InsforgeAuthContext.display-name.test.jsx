import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => {
  const state = {
    accessToken: "synthetic-token-a",
    currentUser: {
      id: "user-a",
      email: "a@example.test",
      user_metadata: { full_name: "OAuth A" },
    },
    restoredUser: {
      id: "user-a",
      email: "a@example.test",
      user_metadata: { full_name: "OAuth A" },
    },
    saveResponse: { display_name: "Server canonical name" },
  };
  const value = {
    state,
    profilesByToken: new Map(),
    queuedVisibilityReads: [],
    client: {
      tokenManager: {
        getAccessToken: () => state.accessToken,
        getSession: () => ({ accessToken: state.accessToken }),
      },
      auth: {
        signInWithPassword: vi.fn(async () => ({ data: { user: state.currentUser }, error: null })),
        signUp: vi.fn(async () => ({ data: { user: state.currentUser, accessToken: state.accessToken }, error: null })),
        getCurrentUser: vi.fn(async () => ({ data: { user: state.currentUser }, error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
    getPublicVisibility: vi.fn(),
    setPublicVisibility: vi.fn(),
    clearCloudDeviceSession: vi.fn(),
    setCloudSyncEnabled: vi.fn(),
    clearLocalApiAuthToken: vi.fn(),
    runCloudUsageSyncNow: vi.fn(),
  };
  return value;
});

vi.mock("../../lib/insforge-config", () => ({
  getOrCreateInsforgeClient: () => fixtures.client,
  isCloudInsforgeConfigured: () => true,
}));

vi.mock("../../lib/insforge-session-recovery.mjs", () => ({
  restoreInsforgeUser: async () => ({ data: { user: fixtures.state.restoredUser }, error: null }),
}));

vi.mock("../../lib/api", () => ({
  getPublicVisibility: (...args) => fixtures.getPublicVisibility(...args),
  setPublicVisibility: (...args) => fixtures.setPublicVisibility(...args),
}));

vi.mock("../../lib/auth-token", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolveAuthAccessTokenWithRetry: ({ getAccessToken }) => getAccessToken(),
  };
});

vi.mock("../../lib/cloud-sync-prefs", () => ({
  clearCloudDeviceSession: (...args) => fixtures.clearCloudDeviceSession(...args),
  getCloudSyncEnabled: () => false,
  isLocalDashboardHost: () => false,
  setCloudSyncEnabled: (...args) => fixtures.setCloudSyncEnabled(...args),
}));

vi.mock("../../lib/cloud-sync", () => ({
  runCloudUsageSyncNow: (...args) => fixtures.runCloudUsageSyncNow(...args),
}));

vi.mock("../../lib/local-api-auth", () => ({
  clearLocalApiAuthToken: (...args) => fixtures.clearLocalApiAuthToken(...args),
  getLocalApiAuthHeaders: vi.fn(async () => ({})),
}));

vi.mock("../../lib/copy", () => ({
  copy: (key) => ({
    "settings.section.account": "Account",
    "settings.account.displayName": "Nickname (display name)",
    "settings.account.displayNameSaveFailed": "Could not save your display name. Please try again.",
    "settings.account.profileLoadFailed": "Could not load profile settings. Refresh and try again.",
    "settings.account.edit": "Edit",
    "settings.account.save": "Save",
    "settings.account.saving": "Saving...",
    "settings.account.cancel": "Cancel",
    "settings.account.userId": "User ID",
    "settings.account.copyUserId": "Copy user ID",
    "settings.account.copy": "Copy",
    "settings.account.copied": "Copied",
    "settings.account.signOut": "Sign out",
    "settings.account.publicProfile": "Public profile",
    "settings.account.publicProfileHint": "Show your usage on the public leaderboard.",
    "settings.account.anonymousMode": "Anonymous mode",
    "settings.account.anonymousModeHint": "Hide your name and avatar on the public leaderboard.",
    "settings.account.cloudSync": "Cloud sync",
    "settings.account.cloudSyncHint": "Upload local usage to your TokenOrbit cloud account.",
    "settings.account.githubUrl": "GitHub profile",
    "settings.account.githubUrlHint": "Show a GitHub link next to your name on the leaderboard.",
    "settings.account.githubUrlPlaceholder": "username or https://github.com/username",
    "settings.account.githubUrlInvalid": "Use a GitHub username or URL.",
  })[key] || key,
}));

vi.mock("../../lib/native-bridge.js", () => ({
  getNativeOAuthBridge: () => null,
  isNativeLinuxApp: () => false,
  isNativeWindowsApp: () => false,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }) => children,
  motion: { div: ({ children }) => children },
}));

import { InsforgeAuthProvider, useInsforgeAuth } from "../InsforgeAuthContext.jsx";
import { clearAllCommunityQueryCache } from "../../lib/community-query-cache.js";
import { AccountSection } from "../../components/settings/AccountSection.jsx";

const USER_A = {
  id: "user-a",
  email: "a@example.test",
  user_metadata: { full_name: "OAuth A" },
};
const USER_B = {
  id: "user-b",
  email: "b@example.test",
  user_metadata: { full_name: "OAuth B" },
};

let currentAuth;

function ContextProbe() {
  const auth = useInsforgeAuth();
  currentAuth = auth;
  return <output data-testid="shared-display-name">{auth.displayName}</output>;
}

function IntegratedAccount() {
  return (
    <InsforgeAuthProvider>
      <ContextProbe />
      <AccountSection />
    </InsforgeAuthProvider>
  );
}

function makeVisibilityProfile(displayName) {
  return {
    enabled: false,
    anonymous: false,
    display_name: displayName,
    show_github_url: false,
    github_url: "",
  };
}

function makeDeferredRead() {
  let resolve;
  let markStarted;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  const started = new Promise((resolveStarted) => { markStarted = resolveStarted; });
  return {
    handler: () => {
      markStarted();
      return promise;
    },
    promise,
    resolve,
    started,
  };
}

function queueVisibilityRead(handler) {
  fixtures.queuedVisibilityReads.push(handler);
}

async function renderIntegratedAccount() {
  render(<IntegratedAccount />);
  await waitFor(() => expect(screen.getByTestId("shared-display-name")).toHaveTextContent("A cloud name"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
}

function setupUser() {
  const user = userEvent.setup();
  const runInAct = (action) => async (...args) => {
    await act(async () => {
      await action(...args);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });
  };

  return {
    click: runInAct(user.click),
    clear: runInAct(user.clear),
    type: runInAct(user.type),
  };
}

async function saveDisplayName(name) {
  const user = setupUser();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  const input = screen.getByRole("textbox", { name: "Nickname (display name)" });
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(fixtures.setPublicVisibility).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
}

async function switchToUserB() {
  fixtures.state.accessToken = "synthetic-token-b";
  fixtures.state.currentUser = USER_B;
  fixtures.profilesByToken.set(fixtures.state.accessToken, makeVisibilityProfile(""));
  await act(async () => { await currentAuth.refreshUser(); });
  await waitFor(() => expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
}

async function finishDeferredRead(deferred, pendingCall) {
  await act(async () => {
    deferred.resolve(makeVisibilityProfile("Late A name"));
    await deferred.promise;
    if (pendingCall) await pendingCall;
  });
}

beforeEach(() => {
  currentAuth = null;
  fixtures.state.accessToken = "synthetic-token-a";
  fixtures.state.currentUser = USER_A;
  fixtures.state.restoredUser = USER_A;
  fixtures.state.saveResponse = { display_name: "Server canonical name" };
  fixtures.profilesByToken.clear();
  fixtures.queuedVisibilityReads.length = 0;
  fixtures.profilesByToken.set(fixtures.state.accessToken, makeVisibilityProfile("A cloud name"));
  fixtures.getPublicVisibility.mockReset().mockImplementation(async ({ accessToken }) => {
    const queuedRead = fixtures.queuedVisibilityReads.shift();
    if (queuedRead) return queuedRead({ accessToken });
    return fixtures.profilesByToken.get(accessToken) || makeVisibilityProfile("");
  });
  fixtures.setPublicVisibility.mockReset().mockImplementation(async () => fixtures.state.saveResponse);
  fixtures.clearCloudDeviceSession.mockReset();
  fixtures.setCloudSyncEnabled.mockReset();
  fixtures.clearLocalApiAuthToken.mockReset();
  fixtures.runCloudUsageSyncNow.mockReset();
  fixtures.client.auth.getCurrentUser.mockReset().mockImplementation(async () => ({
    data: { user: fixtures.state.currentUser },
    error: null,
  }));
  fixtures.client.auth.signInWithPassword.mockReset().mockImplementation(async () => ({
    data: { user: fixtures.state.currentUser },
    error: null,
  }));
  fixtures.client.auth.signOut.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  clearAllCommunityQueryCache();
});

describe("InsforgeAuthProvider display-name session integration", () => {
  it.each(["switch to another account", "sign out and sign in as another account"])(
    "does not apply a late A read after A saves and %s",
    async (transition) => {
      await renderIntegratedAccount();
      const lateRead = makeDeferredRead();
      queueVisibilityRead(lateRead.handler);
      await saveDisplayName("Saved A name");

      // Exercise the provider's ordinary GET refresh while A's profile read is in flight.
      let pendingRefresh;
      act(() => { pendingRefresh = currentAuth.refreshDisplayName(); });
      await lateRead.started;

      if (transition === "switch to another account") {
        await switchToUserB();
      } else {
        await act(async () => { await currentAuth.signOut(); });
        expect(screen.getByTestId("shared-display-name")).toBeEmptyDOMElement();
        await finishDeferredRead(lateRead, pendingRefresh);
        expect(screen.getByTestId("shared-display-name")).toBeEmptyDOMElement();
        await act(async () => {
          fixtures.state.accessToken = "synthetic-token-b";
          fixtures.state.currentUser = USER_B;
          fixtures.profilesByToken.set(fixtures.state.accessToken, makeVisibilityProfile(""));
          await currentAuth.signInWithPassword({ email: USER_B.email, password: "synthetic-test-password" });
        });
        await waitFor(() => expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B"));
        expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B");
        return;
      }

      await finishDeferredRead(lateRead, pendingRefresh);
      expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B");
    },
  );

  it("uses B's OAuth name when A had a cloud nickname and B does not", async () => {
    await renderIntegratedAccount();
    await switchToUserB();

    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B");
    expect(screen.getByTestId("shared-display-name")).not.toHaveTextContent("A cloud name");
  });

  it("does not retain A's nickname when B's profile read fails", async () => {
    await renderIntegratedAccount();
    fixtures.state.accessToken = "synthetic-token-b";
    fixtures.state.currentUser = USER_B;
    fixtures.getPublicVisibility.mockRejectedValue(new Error("synthetic read failure"));

    await act(async () => { await currentAuth.refreshUser(); });

    await waitFor(() => expect(screen.getByTestId("shared-display-name")).toHaveTextContent("OAuth B"));
    expect(screen.getByTestId("shared-display-name")).not.toHaveTextContent("A cloud name");
  });

  it("shows the server-normalized name after save even when a follow-up visibility read would fail", async () => {
    await renderIntegratedAccount();
    const readCount = fixtures.getPublicVisibility.mock.calls.length;
    fixtures.queuedVisibilityReads.push(() => Promise.reject(new Error("synthetic visibility read failure")));

    await saveDisplayName("typed name");

    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("Server canonical name");
    expect(screen.getAllByText("Server canonical name")).toHaveLength(2);
    expect(fixtures.getPublicVisibility).toHaveBeenCalledTimes(readCount);
  });

  it("still refreshes the shared name from the server for the current session", async () => {
    await renderIntegratedAccount();
    queueVisibilityRead(async () => makeVisibilityProfile("Refreshed A name"));

    await act(async () => { await currentAuth.refreshDisplayName(); });

    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("Refreshed A name");
  });

  it("ignores a name read from an older session after the same user signs in again", async () => {
    await renderIntegratedAccount();
    const oldSessionRead = makeDeferredRead();
    queueVisibilityRead(oldSessionRead.handler);
    let pendingRefresh;
    act(() => { pendingRefresh = currentAuth.refreshDisplayName(); });
    await oldSessionRead.started;

    fixtures.state.accessToken = "synthetic-token-a-session-2";
    fixtures.state.currentUser = {
      ...USER_A,
      user_metadata: { full_name: "OAuth A session 2" },
    };
    fixtures.profilesByToken.set(fixtures.state.accessToken, makeVisibilityProfile("New session A name"));
    await act(async () => {
      await currentAuth.signInWithPassword({ email: USER_A.email, password: "synthetic-test-password" });
    });
    await waitFor(() => expect(screen.getByTestId("shared-display-name")).toHaveTextContent("New session A name"));

    await finishDeferredRead(oldSessionRead, pendingRefresh);
    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("New session A name");
  });

  it("keeps the confirmed save name when a GET started before the save resolves afterward", async () => {
    await renderIntegratedAccount();
    const olderRead = makeDeferredRead();
    queueVisibilityRead(olderRead.handler);
    let pendingRefresh;
    act(() => { pendingRefresh = currentAuth.refreshDisplayName(); });
    await olderRead.started;

    await saveDisplayName("typed name");
    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("Server canonical name");

    await finishDeferredRead(olderRead, pendingRefresh);
    expect(screen.getByTestId("shared-display-name")).toHaveTextContent("Server canonical name");
  });
});
