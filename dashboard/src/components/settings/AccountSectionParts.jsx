import React from "react";
import { Pencil } from "lucide-react";
import { useLoginModal } from "../../contexts/LoginModalContext.jsx";
import { copy } from "../../lib/copy";
import { SectionCard, ToggleSwitch } from "./Controls.jsx";

function InlineEditorActions({ disabled, onCancel, onSave, saveLabel = copy("settings.account.save") }) {
  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="rounded-md bg-oai-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-oai-brand-600 disabled:opacity-50"
      >
        {saveLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-2 py-1.5 text-xs text-oai-gray-500 transition-colors hover:text-oai-gray-700 dark:hover:text-oai-gray-300"
      >
        {copy("settings.account.cancel")}
      </button>
    </>
  );
}

function EditNameControls({
  nameError,
  nameInput,
  onCancel,
  setNameInput,
  setNameError,
  profileSaving,
  handleSaveName,
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nameInput}
          onChange={(event) => {
            setNameInput(event.target.value);
            if (nameError) setNameError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSaveName();
            if (event.key === "Escape") onCancel();
          }}
          aria-label={copy("settings.account.displayName")}
          maxLength={50}
          autoFocus
          className="flex-1 rounded-md border border-oai-gray-300 bg-transparent px-2.5 py-1.5 text-sm text-oai-black outline-none focus:border-oai-brand-500 focus:ring-1 focus:ring-inset focus:ring-oai-brand-500 dark:border-oai-gray-700 dark:text-white"
          placeholder={copy("settings.account.displayName")}
        />
        <InlineEditorActions
          disabled={profileSaving || !nameInput.trim()}
          onCancel={onCancel}
          onSave={handleSaveName}
          saveLabel={profileSaving ? copy("settings.account.saving") : undefined}
        />
      </div>
      {nameError ? (
        <div role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {nameError}
        </div>
      ) : null}
    </div>
  );
}

function EditGithubControls({
  githubError,
  githubInput,
  handleSaveGithub,
  profileSaving,
  setEditingGithub,
  setGithubError,
  setGithubInput,
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={githubInput}
          onChange={(event) => {
            setGithubInput(event.target.value);
            if (githubError) setGithubError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSaveGithub();
            if (event.key === "Escape") {
              setEditingGithub(false);
              setGithubError(null);
            }
          }}
          maxLength={100}
          autoFocus
          className="flex-1 rounded-md border border-oai-gray-300 bg-transparent px-2.5 py-1.5 text-sm text-oai-black outline-none focus:border-oai-brand-500 focus:ring-1 focus:ring-inset focus:ring-oai-brand-500 dark:border-oai-gray-700 dark:text-white"
          placeholder={copy("settings.account.githubUrlPlaceholder")}
        />
        <InlineEditorActions
          disabled={profileSaving}
          onCancel={() => {
            setEditingGithub(false);
            setGithubError(null);
          }}
          onSave={handleSaveGithub}
          saveLabel={profileSaving ? copy("settings.account.saving") : undefined}
        />
      </div>
      {githubError ? (
        <div className="mt-1.5 text-xs text-red-600 dark:text-red-400">{githubError}</div>
      ) : null}
    </div>
  );
}

function EditButton({ disabled = false, label, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-oai-gray-200 px-3 text-xs font-medium text-oai-gray-700 transition-colors hover:bg-oai-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-oai-gray-800 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function SettingsField({ actions, editing, editor, hint, label }) {
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-oai-gray-900 dark:text-oai-gray-200">{label}</div>
          {editing ? editor : (
            <div className="mt-0.5 truncate text-xs text-oai-gray-500 dark:text-oai-gray-400">
              {hint}
            </div>
          )}
        </div>
        {editing ? null : actions}
      </div>
    </div>
  );
}

function DisplayNameActions({ name }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <EditButton
        disabled={name.profileLoading || name.profileSaving}
        label={copy("settings.account.edit")}
        onClick={name.startEditingName}
      />
    </div>
  );
}

export function DisplayNameField({ name }) {
  const {
    customDisplayName,
    displayName,
    editingName,
    handleSaveName,
    handleCancelNameEdit,
    nameInput,
    nameError,
    profileLoading,
    profileSaving,
    setNameError,
    setNameInput,
    startEditingName,
  } = name;

  const displayValue = customDisplayName || displayName;

  return (
    <SettingsField
      label={copy("settings.account.displayName")}
      editing={editingName}
      hint={displayValue}
      editor={
        <EditNameControls
          nameError={nameError}
          nameInput={nameInput}
          onCancel={handleCancelNameEdit}
          setNameError={setNameError}
          setNameInput={setNameInput}
          profileSaving={profileSaving}
          handleSaveName={handleSaveName}
        />
      }
      actions={<DisplayNameActions name={name} />}
    />
  );
}

function GithubProfileField({ github }) {
  const {
    editingGithub,
    githubError,
    githubInput,
    githubUrl,
    handleSaveGithub,
    handleShowGithubToggle,
    profileLoading,
    profileSaving,
    setEditingGithub,
    setGithubError,
    setGithubInput,
    showGithubOn,
    startEditingGithub,
  } = github;

  return (
    <>
      <SettingsField
        label={copy("settings.account.githubUrl")}
        editing={editingGithub}
        hint={githubUrl || copy("settings.account.githubUrlHint")}
        editor={
          <EditGithubControls
            githubError={githubError}
            githubInput={githubInput}
            handleSaveGithub={handleSaveGithub}
            profileSaving={profileSaving}
            setEditingGithub={setEditingGithub}
            setGithubError={setGithubError}
            setGithubInput={setGithubInput}
          />
        }
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <EditButton label={copy("settings.account.edit")} onClick={startEditingGithub} />
            <ToggleSwitch
              checked={showGithubOn}
              onChange={handleShowGithubToggle}
              disabled={profileLoading || profileSaving}
              ariaLabel={copy("settings.account.githubUrl")}
            />
          </div>
        }
      />
    </>
  );
}

export function SignedOutAccountSection() {
  const { openLoginModal } = useLoginModal();
  return (
    <SectionCard title={copy("settings.section.account")}>
      <div className="flex items-center justify-between gap-4 py-3">
        <p className="text-sm text-oai-gray-500 dark:text-oai-gray-400">
          {copy("settings.account.signedOutHint")}
        </p>
        <button
          type="button"
          onClick={openLoginModal}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-oai-gray-900 px-4 text-xs font-medium text-white transition-colors hover:bg-oai-gray-800 dark:bg-white dark:text-oai-gray-900 dark:hover:bg-oai-gray-100"
        >
          {copy("settings.account.signIn")}
        </button>
      </div>
    </SectionCard>
  );
}

export function PublicProfileFields({ github }) {
  return (
    <GithubProfileField github={github} />
  );
}
