#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root/TokenTrackerBar"
xcodegen generate
ruby scripts/patch-pbxproj-icon.rb
xcodebuild -scheme TokenTrackerBar -configuration Release -derivedDataPath build/DerivedData \
  ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY="-" \
  CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO \
  OTHER_SWIFT_FLAGS='$(inherited) -Xfrontend -solver-expression-time-threshold=120' clean build
app="$PWD/build/DerivedData/Build/Products/Release/TokenTracker Community.app"
appex="$app/Contents/PlugIns/TokenTrackerWidget.appex"
test -d "$appex"
# Same inner-to-outer ad-hoc signing as the formal packaging workflow.
while IFS= read -r -d '' file; do
  codesign --force --timestamp=none --sign - "$file"
done < <(find "$app/Contents/Resources/EmbeddedServer" -type f \( -name node -o -name '*.dylib' -o -name '*.so' -o -name '*.node' \) -print0)
codesign --force --timestamp=none --entitlements TokenTrackerWidget/TokenTrackerWidget.entitlements --sign - "$appex"
codesign --force --timestamp=none --entitlements TokenTrackerBar/TokenTrackerBar.entitlements --sign - "$app"
codesign --verify --deep --strict --verbose=2 "$app"
codesign -d --entitlements - "$appex" > build/widget-entitlements.plist
/usr/libexec/PlistBuddy -c 'Print :com.apple.security.app-sandbox' build/widget-entitlements.plist | grep -Fx true
bash scripts/create-dmg.sh "$app"
cd "$repo_root"
mkdir -p build/rc/macos
cp TokenTrackerBar/build/TokenTrackerCommunity.dmg build/rc/macos/TokenTrackerCommunity.dmg
mount="$RUNNER_TEMP/community-rc-dmg"
mkdir -p "$mount"
hdiutil attach -readonly -nobrowse -mountpoint "$mount" build/rc/macos/TokenTrackerCommunity.dmg
trap 'hdiutil detach "$mount"' EXIT
app="$mount/TokenTracker Community.app"
plist="$app/Contents/Info.plist"
version="$(node -p "require('./package.json').version")"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist")" = "$version"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$plist")" = 'com.tokentracker.community'
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes:0' "$plist")" = 'tokentracker-community'
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Contents/PlugIns/TokenTrackerWidget.appex/Contents/Info.plist")" = 'com.tokentracker.community.widget'
for executable in "$app/Contents/MacOS/TokenTracker Community" "$app/Contents/Resources/EmbeddedServer/node" "$app/Contents/PlugIns/TokenTrackerWidget.appex/Contents/MacOS/TokenTrackerWidget"; do
  archs="$(lipo -archs "$executable")"
  [[ "$archs" == *arm64* && "$archs" == *x86_64* ]]
done
codesign --verify --deep --strict --verbose=2 "$app"
signature="$(codesign -dv --verbose=2 "$app" 2>&1)"
grep -Fx 'Signature=adhoc' <<< "$signature"
node scripts/rc/verify-runtime.cjs "$app/Contents/Resources/EmbeddedServer" "$app/Contents/MacOS/TokenTracker Community" macos
echo 'PACKAGE PASS DMG: mounted payload, universal app/widget/Node, version, independent bundle/protocol and ad-hoc signature'
node scripts/rc/artifacts.cjs record build/rc/macos macos "$RC_SOURCE_SHA"
