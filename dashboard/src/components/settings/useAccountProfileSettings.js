import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInsforgeAuth } from "../../contexts/InsforgeAuthContext.jsx";
import { resolveAuthAccessTokenWithRetry } from "../../lib/auth-token";
import { getPublicVisibility, setPublicVisibility } from "../../lib/api";
import { runCloudUsageSyncNow } from "../../lib/cloud-sync";
import {
  getCloudSyncEnabled,
  isLocalDashboardHost,
  setCloudSyncEnabled,
} from "../../lib/cloud-sync-prefs";
import { copy } from "../../lib/copy";
import { normalizeGithubProfileUrl, pickDisplayName, pickEmail } from "./AccountSectionUtils.js";

function warnSettingsAction(label, error) {
  console.warn(`[tokentracker] settings ${label}:`, error);
}

function useCloudSyncControl(getAccessToken, enabled, signedIn) {
  const [cloudSyncOn, setCloudSyncOn] = useState(() => getCloudSyncEnabled());
  const showLocalCloudSync = enabled && signedIn && isLocalDashboardHost();

  const handleCloudSyncToggle = useCallback(async () => {
    const next = !cloudSyncOn;
    setCloudSyncEnabled(next);
    setCloudSyncOn(next);
    if (!next) return;
    try {
      await runCloudUsageSyncNow(() => getAccessToken());
    } catch (error) {
      warnSettingsAction("cloud sync", error);
    }
  }, [cloudSyncOn, getAccessToken]);

  return { cloudSyncOn, handleCloudSyncToggle, showLocalCloudSync };
}

function useProfileState(user) {
  const [publicProfileOn, setPublicProfileOn] = useState(null);
  const [anonymousOn, setAnonymousOn] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [customDisplayName, setCustomDisplayName] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState(null);
  const [showGithubOn, setShowGithubOn] = useState(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [editingGithub, setEditingGithub] = useState(false);
  const [githubError, setGithubError] = useState(null);
  const displayName = useMemo(() => pickDisplayName(user), [user]);
  const email = useMemo(() => pickEmail(user), [user]);
  const userId = useMemo(() => (typeof user?.id === "string" ? user.id.trim() : ""), [user]);
  const loadSetters = useMemo(() => ({
    setAnonymousOn,
    setCustomDisplayName,
    setEditingGithub,
    setEditingName,
    setGithubUrl,
    setGithubError,
    setGithubInput,
    setNameError,
    setNameInput,
    setProfileLoading,
    setProfileLoadFailed,
    setProfileSaving,
    setPublicProfileOn,
    setShowGithubOn,
  }), []);

  return {
    anonymousOn,
    customDisplayName,
    displayName,
    editingGithub,
    editingName,
    email,
    githubError,
    githubInput,
    githubUrl,
    loadSetters,
    nameInput,
    nameError,
    profileLoading,
    profileLoadFailed,
    profileSaving,
    publicProfileOn,
    setAnonymousOn,
    setCustomDisplayName,
    setEditingGithub,
    setEditingName,
    setGithubError,
    setGithubInput,
    setGithubUrl,
    setNameInput,
    setNameError,
    setProfileLoading,
    setProfileSaving,
    setPublicProfileOn,
    setShowGithubOn,
    showGithubOn,
    userId,
  };
}

function useProfileLoad(getAccessToken, signedIn, state, sessionEpoch) {
  useEffect(() => {
    if (!signedIn) {
      state.setProfileLoading(false);
      state.setProfileSaving(false);
      state.setPublicProfileOn(null);
      state.setAnonymousOn(null);
      state.setProfileLoadFailed(false);
      state.setEditingName(false);
      state.setNameInput("");
      state.setNameError(null);
      state.setEditingGithub(false);
      state.setGithubInput("");
      state.setGithubError(null);
      return undefined;
    }
    let active = true;
    state.setProfileLoading(true);
    state.setProfileSaving(false);
    state.setProfileLoadFailed(false);
    state.setPublicProfileOn(null);
    state.setAnonymousOn(null);
    state.setCustomDisplayName(null);
    state.setShowGithubOn(null);
    state.setGithubUrl("");
    state.setEditingName(false);
    state.setNameInput("");
    state.setNameError(null);
    state.setEditingGithub(false);
    state.setGithubInput("");
    state.setGithubError(null);
    (async () => {
      try {
        const token = await resolveAuthAccessTokenWithRetry({ getAccessToken });
        if (!active) return;
        if (!token) {
          state.setProfileLoadFailed(true);
          return;
        }
        const data = await getPublicVisibility({ accessToken: token });
        if (!active) return;
        state.setPublicProfileOn(Boolean(data?.enabled));
        state.setAnonymousOn(Boolean(data?.anonymous));
        state.setCustomDisplayName(data?.display_name || null);
        state.setShowGithubOn(Boolean(data?.show_github_url));
        state.setGithubUrl(data?.github_url || "");
      } catch (error) {
        if (active) {
          state.setProfileLoadFailed(true);
          warnSettingsAction("load public profile", error);
        }
      } finally {
        if (active) state.setProfileLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [getAccessToken, signedIn, sessionEpoch, state]);
}

function useProfileMutation(getAccessToken, state, sessionEpoch) {
  const currentSessionEpoch = useRef(sessionEpoch);
  currentSessionEpoch.current = sessionEpoch;

  return useCallback(async (payload, { label, onError, onSuccess } = {}) => {
    if (state.profileSaving) return false;
    const requestSessionEpoch = sessionEpoch;
    state.setProfileSaving(true);
    try {
      const token = await resolveAuthAccessTokenWithRetry({ getAccessToken });
      if (currentSessionEpoch.current !== requestSessionEpoch) return true;
      if (!token) return false;
      const response = await setPublicVisibility({ accessToken: token, ...payload });
      if (currentSessionEpoch.current !== requestSessionEpoch) return true;
      onSuccess?.(response);
      return true;
    } catch (error) {
      if (currentSessionEpoch.current !== requestSessionEpoch) return true;
      if (onError) onError(error);
      else warnSettingsAction(label || "mutate profile", error);
      return false;
    } finally {
      if (currentSessionEpoch.current === requestSessionEpoch) state.setProfileSaving(false);
    }
  }, [getAccessToken, sessionEpoch, state]);
}

function buildNameProps(state, actions) {
  return {
    anonymousOn: state.anonymousOn,
    customDisplayName: state.customDisplayName,
    displayName: state.displayName,
    editingName: state.editingName,
    handleAnonymousToggle: actions.handleAnonymousToggle,
    handleSaveName: actions.handleSaveName,
    handleCancelNameEdit: actions.handleCancelNameEdit,
    nameInput: state.nameInput,
    nameError: state.nameError,
    profileLoading: state.profileLoading,
    profileSaving: state.profileSaving,
    setEditingName: state.setEditingName,
    setNameInput: state.setNameInput,
    setNameError: state.setNameError,
    startEditingName: actions.startEditingName,
  };
}

function buildGithubProps(state, actions) {
  return {
    editingGithub: state.editingGithub,
    githubError: state.githubError,
    githubInput: state.githubInput,
    githubUrl: state.githubUrl,
    handleSaveGithub: actions.handleSaveGithub,
    handleShowGithubToggle: actions.handleShowGithubToggle,
    profileLoading: state.profileLoading,
    profileSaving: state.profileSaving,
    setEditingGithub: state.setEditingGithub,
    setGithubError: state.setGithubError,
    setGithubInput: state.setGithubInput,
    showGithubOn: state.showGithubOn,
    startEditingGithub: actions.startEditingGithub,
  };
}

function useVisibilityActions(state, mutateProfile) {
  const handlePublicProfileToggle = useCallback(async () => {
    const next = !state.publicProfileOn;
    await mutateProfile(
      { enabled: next },
      { label: "toggle public profile", onSuccess: () => state.setPublicProfileOn(next) },
    );
  }, [mutateProfile, state]);

  const handleAnonymousToggle = useCallback(async () => {
    const next = !state.anonymousOn;
    await mutateProfile(
      { anonymous: next },
      { label: "toggle anonymous", onSuccess: () => state.setAnonymousOn(next) },
    );
  }, [mutateProfile, state]);

  return { handleAnonymousToggle, handlePublicProfileToggle };
}

function useNameActions(state, mutateProfile, refreshDisplayName) {
  const handleSaveName = useCallback(async () => {
    const trimmed = state.nameInput.trim().slice(0, 50);
    if (!trimmed || state.profileSaving) return;
    state.setNameError(null);
    const saved = await mutateProfile({ display_name: trimmed }, {
      label: "save display name",
      onError: () => state.setNameError(copy("settings.account.displayNameSaveFailed")),
      onSuccess: (response) => {
        const confirmedName = typeof response?.display_name === "string" ? response.display_name : trimmed;
        state.setCustomDisplayName(confirmedName);
        state.setEditingName(false);
        state.setNameError(null);
        // Propagate to the shared auth-context displayName so the sidebar
        // avatar/name updates immediately, without a full page reload. The
        // leaderboard self-name comes from a server snapshot and updates on
        // its own refresh cadence.
        refreshDisplayName?.(confirmedName);
      },
    });
    if (!saved) state.setNameError(copy("settings.account.displayNameSaveFailed"));
  }, [mutateProfile, state, refreshDisplayName]);

  const startEditingName = useCallback(() => {
    state.setNameInput(state.customDisplayName || state.displayName);
    state.setNameError(null);
    state.setEditingName(true);
  }, [state]);

  const handleCancelNameEdit = useCallback(() => {
    state.setNameError(null);
    state.setEditingName(false);
  }, [state]);

  return { handleCancelNameEdit, handleSaveName, startEditingName };
}

function useGithubActions(state, mutateProfile) {
  const handleShowGithubToggle = useCallback(async () => {
    if (!state.showGithubOn && !state.githubUrl) {
      state.setEditingGithub(true);
      state.setGithubInput("");
      state.setGithubError(null);
      return;
    }
    const next = !state.showGithubOn;
    await mutateProfile(
      { show_github_url: next },
      { label: "toggle GitHub profile", onSuccess: () => state.setShowGithubOn(next) },
    );
  }, [mutateProfile, state]);

  const handleSaveGithub = useCallback(async () => {
    const normalizedUrl = normalizeGithubProfileUrl(state.githubInput);
    if (state.githubInput.trim() && !normalizedUrl) {
      state.setGithubError(copy("settings.account.githubUrlInvalid"));
      return;
    }
    state.setGithubError(null);
    await mutateProfile(
      { github_url: normalizedUrl, show_github_url: Boolean(normalizedUrl) },
      {
        label: "save GitHub profile",
        onError: (error) => state.setGithubError(error?.message || copy("settings.account.githubUrlInvalid")),
        onSuccess: (response) => {
          state.setGithubUrl(response?.github_url || normalizedUrl || "");
          state.setShowGithubOn(Boolean(normalizedUrl));
          state.setEditingGithub(false);
        },
      },
    );
  }, [mutateProfile, state]);

  const startEditingGithub = useCallback(() => {
    state.setGithubInput(state.githubUrl);
    state.setGithubError(null);
    state.setEditingGithub(true);
  }, [state]);

  return { handleSaveGithub, handleShowGithubToggle, startEditingGithub };
}

export function useAccountProfileSettings() {
  const auth = useInsforgeAuth();
  const state = useProfileState(auth.user);
  const cloudSync = useCloudSyncControl(auth.getAccessToken, auth.enabled, auth.signedIn);
  useProfileLoad(auth.getAccessToken, auth.signedIn, state.loadSetters, auth.sessionEpoch);
  const mutateProfile = useProfileMutation(auth.getAccessToken, state, auth.sessionEpoch);
  const visibilityActions = useVisibilityActions(state, mutateProfile);
  const nameActions = useNameActions(state, mutateProfile, auth.refreshDisplayName);
  const githubActions = useGithubActions(state, mutateProfile);

  return {
    ...auth,
    ...cloudSync,
    email: state.email,
    handlePublicProfileToggle: visibilityActions.handlePublicProfileToggle,
    userId: state.userId,
    name: buildNameProps(state, { ...visibilityActions, ...nameActions }),
    github: buildGithubProps(state, githubActions),
    profileLoading: state.profileLoading,
    profileLoadFailed: state.profileLoadFailed,
    profileSaving: state.profileSaving,
    publicProfileOn: state.publicProfileOn,
  };
}
