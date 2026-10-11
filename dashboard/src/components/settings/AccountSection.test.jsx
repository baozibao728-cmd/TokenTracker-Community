import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSection } from "./AccountSection.jsx";

const mocks = vi.hoisted(() => ({
  auth: {
    enabled: true,
    signedIn: true,
    sessionEpoch: 1,
    user: {
      id: "user-123",
      email: "person@example.com",
      user_metadata: { full_name: "OAuth name" },
    },
    getAccessToken: vi.fn(async () => "access-token"),
    refreshDisplayName: vi.fn(),
    signOut: vi.fn(),
  },
  getPublicVisibility: vi.fn(),
  setPublicVisibility: vi.fn(),
  persistedProfile: null,
  setCloudSyncEnabled: vi.fn(),
}));

const LABELS = {
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
};

vi.mock("../../contexts/InsforgeAuthContext.jsx", () => ({
  useInsforgeAuth: () => mocks.auth,
}));

vi.mock("../../lib/auth-token", () => ({
  resolveAuthAccessTokenWithRetry: ({ getAccessToken }) => getAccessToken(),
}));

vi.mock("../../lib/api", () => ({
  getPublicVisibility: (...args) => mocks.getPublicVisibility(...args),
  setPublicVisibility: (...args) => mocks.setPublicVisibility(...args),
}));

vi.mock("../../lib/cloud-sync", () => ({ runCloudUsageSyncNow: vi.fn() }));

vi.mock("../../lib/cloud-sync-prefs", () => ({
  getCloudSyncEnabled: () => false,
  isLocalDashboardHost: () => false,
  setCloudSyncEnabled: (...args) => mocks.setCloudSyncEnabled(...args),
}));

vi.mock("../../lib/copy", () => ({
  copy: (key) => LABELS[key] || key,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }) => children,
  motion: { div: ({ children }) => children },
}));

vi.mock("./Controls.jsx", () => ({
  SectionCard: ({ title, subtitle, action, children }) => (
    <section>
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      {action}
      {children}
    </section>
  ),
  SettingsRow: ({ label, hint, control }) => (
    <div>
      <span>{label}</span>
      <span>{hint}</span>
      {control}
    </div>
  ),
  ToggleSwitch: ({ checked, onChange, disabled, ariaLabel }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      disabled={disabled}
    />
  ),
}));

function nicknameRow() {
  return screen.getByText("Nickname (display name)").closest(".py-3");
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
    keyboard: runInAct(user.keyboard),
    type: runInAct(user.type),
  };
}

async function renderAndLoadAccountSection() {
  let view;
  await act(async () => {
    view = render(<AccountSection />);
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  });
  await waitFor(() => {
    expect(within(nicknameRow()).getByRole("button", { name: "Edit" })).toBeEnabled();
  });
  return view;
}

describe("AccountSection display name settings", () => {
  beforeEach(() => {
    mocks.auth.enabled = true;
    mocks.auth.signedIn = true;
    mocks.auth.sessionEpoch = 1;
    mocks.auth.user = {
      id: "user-123",
      email: "person@example.com",
      user_metadata: { full_name: "OAuth name" },
    };
    mocks.auth.getAccessToken.mockReset().mockResolvedValue("access-token");
    mocks.auth.refreshDisplayName.mockReset();
    mocks.auth.signOut.mockReset();
    mocks.persistedProfile = {
      enabled: false,
      anonymous: false,
      display_name: "Persisted display name",
      show_github_url: false,
      github_url: "",
    };
    mocks.getPublicVisibility.mockReset().mockImplementation(async () => ({ ...mocks.persistedProfile }));
    mocks.setPublicVisibility.mockReset().mockImplementation(async ({ accessToken, ...updates }) => {
      mocks.persistedProfile = { ...mocks.persistedProfile, ...updates };
      return updates;
    });
    mocks.setCloudSyncEnabled.mockReset();
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])("saves only the nickname when public=%s and anonymous=%s", async (enabled, anonymous) => {
    const user = setupUser();
    mocks.persistedProfile = { ...mocks.persistedProfile, enabled, anonymous };
    await renderAndLoadAccountSection();

    const name = await screen.findByText("Persisted display name");
    const nameRow = nicknameRow();
    expect(nameRow).toContainElement(name);
    expect(within(nameRow).getByRole("button", { name: "Edit" })).toBeEnabled();
    expect(within(nameRow).queryByRole("switch")).not.toBeInTheDocument();

    const userId = screen.getByText("User ID");
    expect(name.compareDocumentPosition(userId) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Public profile" })).toHaveAttribute(
      "aria-checked",
      String(enabled),
    );
    expect(screen.getByRole("switch", { name: "Anonymous mode" })).toHaveAttribute(
      "aria-checked",
      String(anonymous),
    );

    await user.click(within(nameRow).getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Nickname (display name)" });
    expect(input).toHaveValue("Persisted display name");
    await user.clear(input);
    await user.type(input, `Updated ${enabled}-${anonymous}`);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(`Updated ${enabled}-${anonymous}`)).toBeInTheDocument();
    expect(mocks.setPublicVisibility).toHaveBeenCalledTimes(1);
    expect(mocks.setPublicVisibility).toHaveBeenCalledWith({
      accessToken: "access-token",
      display_name: `Updated ${enabled}-${anonymous}`,
    });
    expect(mocks.persistedProfile).toMatchObject({ enabled, anonymous });
    expect(mocks.setCloudSyncEnabled).not.toHaveBeenCalled();
    expect(mocks.auth.refreshDisplayName).toHaveBeenCalledTimes(1);
  });

  it("shows a safe save failure and lets the user cancel the edit", async () => {
    const user = setupUser();
    mocks.setPublicVisibility.mockRejectedValueOnce(new Error("database internals"));
    await renderAndLoadAccountSection();

    await screen.findByText("Persisted display name");
    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Nickname (display name)" });
    expect(input).toHaveAttribute("maxLength", "50");
    await user.clear(input);
    await user.type(input, "Unsaved name");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save your display name. Please try again.",
    );
    expect(screen.queryByText("database internals")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: "Nickname (display name)" })).not.toBeInTheDocument();
    expect(mocks.auth.refreshDisplayName).not.toHaveBeenCalled();
  });

  it("keeps public and anonymous controls disabled when their saved values could not be loaded", async () => {
    const user = setupUser();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getPublicVisibility.mockRejectedValueOnce(new Error("backend details"));
    await renderAndLoadAccountSection();

    expect(await screen.findAllByText("Could not load profile settings. Refresh and try again.")).toHaveLength(2);
    expect(screen.getByRole("switch", { name: "Public profile" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Anonymous mode" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled();
    await user.click(screen.getByRole("switch", { name: "Public profile" }));
    expect(mocks.setPublicVisibility).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[tokentracker] settings load public profile:", expect.any(Error));
    warn.mockRestore();
  });

  it("clears the old nickname editor when the signed-in session changes", async () => {
    const user = setupUser();
    mocks.setPublicVisibility.mockRejectedValueOnce(new Error("old account failure"));
    const view = await renderAndLoadAccountSection();

    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    const oldInput = screen.getByRole("textbox", { name: "Nickname (display name)" });
    await user.clear(oldInput);
    await user.type(oldInput, "Old account draft");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    mocks.auth.sessionEpoch = 2;
    mocks.auth.user = {
      id: "user-456",
      email: "other@example.com",
      user_metadata: { full_name: "Other OAuth name" },
    };
    mocks.persistedProfile = {
      enabled: true,
      anonymous: false,
      display_name: "Other account name",
      show_github_url: false,
      github_url: "",
    };
    await act(async () => {
      view.rerender(<AccountSection />);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });
    expect(await screen.findByText("Other account name")).toBeInTheDocument();

    expect(screen.queryByRole("textbox", { name: "Nickname (display name)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Public profile" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Nickname (display name)" })).toHaveValue("Other account name");
  });

  it("supports Escape cancel and Enter save with a display-name-only update that survives remount", async () => {
    const user = setupUser();
    mocks.persistedProfile = { ...mocks.persistedProfile, enabled: false, anonymous: true };
    const view = await renderAndLoadAccountSection();

    await screen.findByText("Persisted display name");
    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    const firstInput = screen.getByRole("textbox", { name: "Nickname (display name)" });
    await user.clear(firstInput);
    await user.type(firstInput, "Discard this");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Nickname (display name)" })).not.toBeInTheDocument();
    expect(mocks.setPublicVisibility).not.toHaveBeenCalled();

    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Nickname (display name)" });
    await user.clear(input);
    await user.type(input, "Updated display name");
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Updated display name")).toBeInTheDocument();
    expect(mocks.setPublicVisibility).toHaveBeenCalledWith({
      accessToken: "access-token",
      display_name: "Updated display name",
    });
    expect(mocks.persistedProfile).toMatchObject({ enabled: false, anonymous: true });
    expect(mocks.setCloudSyncEnabled).not.toHaveBeenCalled();
    expect(mocks.auth.refreshDisplayName).toHaveBeenCalledTimes(1);

    view.unmount();
    mocks.getPublicVisibility.mockClear();
    await renderAndLoadAccountSection();
    expect(await screen.findByText("Updated display name")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getPublicVisibility).toHaveBeenCalledTimes(1));
  });

  it("ignores a nickname mutation that resolves after the signed-in session changes", async () => {
    const user = setupUser();
    let resolveSave;
    mocks.setPublicVisibility.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    const view = await renderAndLoadAccountSection();

    await user.click(within(nicknameRow()).getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Nickname (display name)" });
    await user.clear(input);
    await user.type(input, "Late old account name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.setPublicVisibility).toHaveBeenCalledTimes(1));

    mocks.auth.sessionEpoch = 2;
    mocks.auth.user = {
      id: "user-456",
      email: "other@example.com",
      user_metadata: { full_name: "Other OAuth name" },
    };
    mocks.persistedProfile = {
      enabled: true,
      anonymous: true,
      display_name: "Current account name",
      show_github_url: false,
      github_url: "",
    };
    await act(async () => {
      view.rerender(<AccountSection />);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });
    expect(await screen.findByText("Current account name")).toBeInTheDocument();

    await act(async () => {
      resolveSave({ display_name: "Late old account name" });
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });

    expect(screen.getByText("Current account name")).toBeInTheDocument();
    expect(screen.queryByText("Late old account name")).not.toBeInTheDocument();
    expect(mocks.auth.refreshDisplayName).not.toHaveBeenCalled();
    expect(mocks.persistedProfile).toMatchObject({ enabled: true, anonymous: true });
  });
});
