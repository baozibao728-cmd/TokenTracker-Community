#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root"
bundle=TokenTrackerLinux/src-tauri/target/release/bundle
out=build/rc/linux
mkdir -p "$out"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
version="$(node -p "require('./package.json').version")"
pick_one() {
  local files=("$@")
  test "${#files[@]}" -eq 1 && test -f "${files[0]}"
  printf '%s' "${files[0]}"
}
verify_payload() {
  local label="$1" root="$2" node_bin binary desktop
  binary="$root/usr/bin/tokentracker-community-linux"
  test -x "$binary"
  file "$binary" | grep -F 'x86-64'
  node_bin="$(find "$root/usr/lib" -type f -name node -path '*/EmbeddedServer/*' -print -quit)"
  test -n "$node_bin" && test -x "$node_bin"
  node scripts/rc/verify-runtime.cjs "$(dirname "$node_bin")" "$binary" linux
  desktop="$(find "$root/usr/share/applications" -type f -name '*.desktop' -print -quit)"
  test -f "$desktop"
  grep -Fx 'Name=TokenTracker Community' "$desktop"
  if [ "$label" = AppImage ]; then
    # Tauri's AppImage desktop file has no deb/rpm desktopTemplate setting.
    # The shipped binary explicitly registers its own handler at startup.
    # Prove that declaration is in THIS binary, not just in the source tree.
    grep -aFq 'MimeType=x-scheme-handler/tokentracker-community;' "$binary"
    grep -aFq 'tokentracker-community-appimage.desktop' "$binary"
  else
    grep -Fx 'MimeType=x-scheme-handler/tokentracker-community;' "$desktop"
    grep -Eq '^Exec=.*tokentracker-community-linux %u$' "$desktop"
    desktop-file-validate "$desktop"
  fi
  echo "PACKAGE PASS $label: x86_64 payload, independent executable/desktop identity and protocol declaration"
}
shopt -s nullglob
image="$(pick_one "$bundle"/appimage/*.AppImage)"
deb="$(pick_one "$bundle"/deb/*.deb)"
rpm_pkg="$(pick_one "$bundle"/rpm/*.rpm)"
test "$(basename "$image")" = "TokenTracker Community_${version}_amd64.AppImage"
cp "$image" "$work/app.AppImage"
chmod +x "$work/app.AppImage"
(cd "$work" && ./app.AppImage --appimage-extract >/dev/null)
verify_payload AppImage "$work/squashfs-root"
node scripts/rc/linux-package.cjs deb "$(dpkg-deb -f "$deb" Package)" "$(dpkg-deb -f "$deb" Version)" "$(dpkg-deb -f "$deb" Architecture)"
mkdir -p "$work/deb"
dpkg-deb -x "$deb" "$work/deb"
verify_payload deb "$work/deb"
node scripts/rc/linux-package.cjs rpm "$(rpm -qp --qf '%{NAME}' "$rpm_pkg")" "$(rpm -qp --qf '%{VERSION}' "$rpm_pkg")" "$(rpm -qp --qf '%{ARCH}' "$rpm_pkg")"
mkdir -p "$work/rpm"
rpm_abs="$(realpath "$rpm_pkg")"
(cd "$work/rpm" && rpm2cpio "$rpm_abs" | cpio -idm --quiet)
verify_payload rpm "$work/rpm"
cp "$image" "$out/TokenTracker-Community-linux-x86_64.AppImage"
cp "$deb" "$out/TokenTracker-Community-linux-x86_64.deb"
cp "$rpm_pkg" "$out/TokenTracker-Community-linux-x86_64.rpm"
node scripts/rc/artifacts.cjs record "$out" linux "$RC_SOURCE_SHA"
