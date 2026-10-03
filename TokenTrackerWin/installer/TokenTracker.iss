; ─────────────────────────────────────────────────────────────────────────
; TokenTracker.iss — Inno Setup script for the Windows tray app.
;
; Builds a per-user installer (no admin / UAC) that matches the app's own
; design: tokentracker-community:// protocol and launch-at-startup are registered by
; the app at runtime under HKCU, so the installer only lays down files +
; shortcuts and never touches machine-wide state.
;
; Inputs:
;   ISCC.exe /DMyAppVersion=0.31.1 TokenTracker.iss
;
; Expects the self-contained publish output next to this script at
; ..\publish\ (TokenTrackerCommunity.exe + the .NET runtime + EmbeddedServer\),
; produced by:
;   dotnet publish ... --self-contained true -o TokenTrackerWin\publish
;   Copy-Item TokenTrackerWin\EmbeddedServer  TokenTrackerWin\publish\EmbeddedServer
; ─────────────────────────────────────────────────────────────────────────

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

#ifndef PublishDir
  #define PublishDir "..\publish"
#endif

#define MyAppName "TokenTracker Community"
#define MyAppPublisher "baozibao728-cmd"
#define MyAppURL "https://github.com/baozibao728-cmd/TokenTracker-Community"
#define MyAppExeName "TokenTrackerCommunity.exe"

[Setup]
; Stable per-product GUID — keep constant so upgrades replace in place and
; uninstall stays a single Add/Remove Programs entry.
AppId={{638F4DBF-F2B4-4408-B654-5A5D0F5B7AC7}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
; Per-user install: no admin rights, lands in %LOCALAPPDATA%\Programs.
PrivilegesRequired=lowest
DefaultDirName={localappdata}\Programs\TokenTrackerCommunity
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
SetupIconFile=..\assets\trayicon.ico
OutputDir=Output
OutputBaseFilename=TokenTracker-Community-Setup-v{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Close a running tray instance (and its EmbeddedServer\node.exe child, which
; holds a file lock) before overwriting its files on upgrade. We drive the
; relaunch ourselves after a silent update, so don't let Restart Manager do it.
CloseApplications=yes
RestartApplications=no

; A language picker appears at setup start (Inno shows it automatically when more
; than one language is listed). English ships with Inno; the Chinese message files
; are bundled here (UTF-8 with BOM) since Inno does not include them.
[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"
Name: "chinesetraditional"; MessagesFile: "ChineseTraditional.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; Flags: unchecked

[InstallDelete]
; Vite assets have content-hashed names. Remove only this product's old built
; dashboard before replacing it, so upgrades cannot retain retired entry files.
; User data lives outside this installation directory and is never removed here.
Type: filesandordirs; Name: "{app}\EmbeddedServer\tokentracker\dashboard\dist"

[Files]
; The whole self-contained publish folder, including EmbeddedServer\ which
; ServerManager resolves from AppContext.BaseDirectory at runtime.
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{userprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    { Only this product's runtime registrations; preserve all user data. }
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Classes\tokentracker-community');
    RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'TokenTrackerCommunity');
  end;
end;
