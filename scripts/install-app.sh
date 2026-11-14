#!/usr/bin/env bash
set -euo pipefail
# pgrep/pkill fail under some locales (C.UTF-8), which left the old app running.
export LC_ALL=C

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# SCRAWL_APP_DIR builds the signed bundle somewhere else (staging for remote installs, see
# install-app-remote.sh); SCRAWL_NO_LAUNCH=1 skips the ~/bin link and the restart.
APP_DIR="${SCRAWL_APP_DIR:-${HOME}/Applications/Pointo.app}"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
FRAMEWORKS_DIR="${CONTENTS_DIR}/Frameworks"
SPARKLE_PUBLIC_KEY="f1/njbYaKbKsSsU/uNfo6cIB/bHYqHuU3nFjZkx4Bus="

cd "${REPO_DIR}"
chmod +x "${REPO_DIR}/scripts/setup-sparkle.sh" "${REPO_DIR}/scripts/release-app.sh" 2>/dev/null || true
SPARKLE_DIR="$("${REPO_DIR}/scripts/setup-sparkle.sh" 2>/dev/null || true)"
taskpolicy -c utility cargo build -j 3

mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}" "${FRAMEWORKS_DIR}" "${HOME}/bin"

rm -f "${MACOS_DIR}/pointo" "${MACOS_DIR}/pointo-helper"
cp -f "${REPO_DIR}/target/debug/pointo" "${MACOS_DIR}/pointo"
cp -f "${REPO_DIR}/target/debug/pointo-helper" "${MACOS_DIR}/pointo-helper"
chmod +x "${MACOS_DIR}/pointo" "${MACOS_DIR}/pointo-helper"

# Liquid Glass icon (Assets.car, rendered live by macOS 26) plus Pointo.icns for macOS 15, both
# compiled from the Icon Composer file; the committed .icns is the fallback without Xcode.
if ! xcrun actool "${REPO_DIR}/assets/Pointo.icon" --compile "${RESOURCES_DIR}" --platform macosx \
    --minimum-deployment-target 15.0 --app-icon Pointo \
    --output-partial-info-plist "$(mktemp -t pointo-icon)" >/dev/null; then
  cp -f "${REPO_DIR}/assets/Pointo.icns" "${RESOURCES_DIR}"/Pointo.icns
fi

if [[ -n "${SPARKLE_DIR}" && -d "${SPARKLE_DIR}/Sparkle.framework" ]]; then
  rm -rf "${FRAMEWORKS_DIR}/Sparkle.framework"
  /usr/bin/ditto "${SPARKLE_DIR}/Sparkle.framework" "${FRAMEWORKS_DIR}/Sparkle.framework"
fi

cat > "${CONTENTS_DIR}/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>pointo</string>
  <key>CFBundleIconFile</key>
  <string>Pointo</string>
  <key>CFBundleIconName</key>
  <string>Pointo</string>
  <key>CFBundleIdentifier</key>
  <string>dev.xiechimon.pointo</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Pointo</string>
  <key>CFBundleDisplayName</key>
  <string>Pointo</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>15.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSScreenCaptureUsageDescription</key>
  <string>Pointo 录制你的屏幕，生成给 AI 看的带标注录制包。</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Pointo 录下你的讲解，把转写文字和关键帧对齐。</string>
  <key>NSCameraUsageDescription</key>
  <string>Pointo 显示并录制用数据线连接的 iPhone 屏幕。</string>
  <key>NSAppleEventsUsageDescription</key>
  <string>Pointo 读取你录制的浏览器标签页地址，用来把开发中网页的录制投递到对应的项目。</string>
  <key>SUEnableAutomaticChecks</key>
  <false/>
  <key>SUAutomaticallyUpdate</key>
  <false/>
  <key>SUAllowsAutomaticUpdates</key>
  <false/>
  <key>SUFeedURL</key>
  <string>https://xiechimon.github.io/pointo/appcast.xml</string>
  <key>SUPublicEDKey</key>
  <string>${SPARKLE_PUBLIC_KEY}</string>
  <key>SUVerifyUpdateBeforeExtraction</key>
  <true/>
</dict>
</plist>
PLIST

IDENTITY="$("${REPO_DIR}/scripts/sign-identity.sh")"
if [[ -d "${FRAMEWORKS_DIR}/Sparkle.framework/Versions/B" ]]; then
  SPARKLE_VER="${FRAMEWORKS_DIR}/Sparkle.framework/Versions/B"
  codesign --force --sign "${IDENTITY}" "${SPARKLE_VER}/XPCServices/Installer.xpc"
  codesign --force --sign "${IDENTITY}" --preserve-metadata=entitlements "${SPARKLE_VER}/XPCServices/Downloader.xpc"
  codesign --force --sign "${IDENTITY}" "${SPARKLE_VER}/Autoupdate"
  codesign --force --sign "${IDENTITY}" "${SPARKLE_VER}/Updater.app"
  codesign --force --sign "${IDENTITY}" "${FRAMEWORKS_DIR}/Sparkle.framework"
fi
codesign --force --sign "${IDENTITY}" --identifier "dev.xiechimon.pointo.helper" "${MACOS_DIR}/pointo-helper"
codesign --force --sign "${IDENTITY}" --identifier "dev.xiechimon.pointo" "${APP_DIR}"

if [[ "${SCRAWL_NO_LAUNCH:-0}" == "1" ]]; then
  exit 0
fi

ln -sf "${MACOS_DIR}/pointo" "${HOME}/bin/pointo"

scrawl_running() {
  local status=0
  pgrep -f "Pointo.app/Contents/MacOS/pointo" >/dev/null || status=$?
  case "${status}" in
    0) return 0 ;;
    1) return 1 ;;
    *) echo "pgrep failed (exit ${status}); can't tell whether the old Pointo stopped" >&2; exit 1 ;;
  esac
}

pkill -f "Pointo.app/Contents/MacOS/pointo" 2>/dev/null || true
pkill -f "target/debug/pointo" 2>/dev/null || true
for _ in {1..40}; do
  scrawl_running || break
  sleep 0.05
done
if scrawl_running; then
  pgrep -fl "Pointo.app/Contents/MacOS/pointo" >&2 || true
  echo "the old Pointo is still running; quit it and run this again" >&2
  exit 1
fi
open -a "${APP_DIR}" || (sleep 0.3 && open -n -a "${APP_DIR}")
sleep 0.3
pgrep -fl "Pointo.app/Contents/MacOS/pointo"
