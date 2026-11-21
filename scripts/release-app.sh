#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-prepare}"
VERSION="${SCRAWL_VERSION:-$(sed -n 's/^version = "\(.*\)"/\1/p' "${REPO_DIR}/Cargo.toml" | head -1)}"
BUILD_NUMBER="${SCRAWL_BUILD_NUMBER:-1}"
# The update feed and the downloads are served from the project site (GitHub Pages): its deploy
# copies the latest GitHub release's files into releases/ (see .github/workflows/pages.yml),
# because release-assets.githubusercontent.com is unreachable from many networks in China.
BASE_URL="${POINTO_SITE_URL:-https://xiechimon.github.io/pointo}"
REPO_SLUG="${POINTO_REPO:-xiechimon/pointo}"
SPARKLE_PUBLIC_KEY="f1/njbYaKbKsSsU/uNfo6cIB/bHYqHuU3nFjZkx4Bus="

DIST_DIR="${REPO_DIR}/dist"
UPDATES_DIR="${DIST_DIR}/updates"
APP_BUNDLE="${DIST_DIR}/Pointo.app"
DMG_NAME="Pointo-${VERSION}-arm64.dmg"
LATEST_DMG="Pointo-latest-arm64.dmg"
ZIP_NAME="Pointo-${VERSION}-arm64.zip"

cd "${REPO_DIR}"
SPARKLE_DIR="$("${REPO_DIR}/scripts/setup-sparkle.sh")"

taskpolicy -c utility cargo build --release -j 3 --offline

rm -rf "${APP_BUNDLE}" "${DIST_DIR}/staging" "${UPDATES_DIR}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS" "${APP_BUNDLE}/Contents/Resources" "${APP_BUNDLE}/Contents/Frameworks" "${DIST_DIR}/staging" "${UPDATES_DIR}"

cp -f "${REPO_DIR}/target/release/pointo" "${APP_BUNDLE}/Contents/MacOS/pointo"
cp -f "${REPO_DIR}/target/release/pointo-helper" "${APP_BUNDLE}/Contents/MacOS/pointo-helper"
chmod +x "${APP_BUNDLE}/Contents/MacOS/pointo" "${APP_BUNDLE}/Contents/MacOS/pointo-helper"

# Liquid Glass icon (Assets.car, rendered live by macOS 26) plus Pointo.icns for macOS 15, both
# compiled from the Icon Composer file; the committed .icns is the fallback without Xcode.
if ! xcrun actool "${REPO_DIR}/assets/Pointo.icon" --compile "${APP_BUNDLE}/Contents/Resources" --platform macosx \
    --minimum-deployment-target 15.0 --app-icon Pointo \
    --output-partial-info-plist "$(mktemp -t pointo-icon)" >/dev/null; then
  cp -f "${REPO_DIR}/assets/Pointo.icns" "${APP_BUNDLE}/Contents/Resources"/Pointo.icns
fi

/usr/bin/ditto "${SPARKLE_DIR}/Sparkle.framework" "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"

cat > "${APP_BUNDLE}/Contents/Info.plist" <<PLIST
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
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${BUILD_NUMBER}</string>
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
  <true/>
  <key>SUAutomaticallyUpdate</key>
  <false/>
  <key>SUAllowsAutomaticUpdates</key>
  <false/>
  <key>SUFeedURL</key>
  <string>${BASE_URL}/appcast.xml</string>
  <key>SUPublicEDKey</key>
  <string>${SPARKLE_PUBLIC_KEY}</string>
  <key>SUVerifyUpdateBeforeExtraction</key>
  <true/>
</dict>
</plist>
PLIST

IDENTITY="$("${REPO_DIR}/scripts/sign-identity.sh")"

ENTITLEMENTS="${REPO_DIR}/scripts/Pointo.entitlements"
# Notarization requires the hardened runtime and a secure timestamp on every signed binary.
SIGN=(codesign --force --options runtime --timestamp --sign "${IDENTITY}")
if [[ "${IDENTITY}" == "-" ]]; then
  SIGN=(codesign --force --sign "-")
fi

SPARKLE_VER="${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework/Versions/B"
"${SIGN[@]}" "${SPARKLE_VER}/XPCServices/Installer.xpc"
"${SIGN[@]}" --preserve-metadata=entitlements "${SPARKLE_VER}/XPCServices/Downloader.xpc"
"${SIGN[@]}" "${SPARKLE_VER}/Autoupdate"
"${SIGN[@]}" "${SPARKLE_VER}/Updater.app"
"${SIGN[@]}" "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"
"${SIGN[@]}" --entitlements "${ENTITLEMENTS}" --identifier "dev.xiechimon.pointo.helper" "${APP_BUNDLE}/Contents/MacOS/pointo-helper"
"${SIGN[@]}" --entitlements "${ENTITLEMENTS}" --identifier "dev.xiechimon.pointo" "${APP_BUNDLE}"

/usr/bin/ditto "${APP_BUNDLE}" "${DIST_DIR}/staging/Pointo.app"
ln -s /Applications "${DIST_DIR}/staging/Applications"
rm -f "${DIST_DIR}/${DMG_NAME}" "${DIST_DIR}/${LATEST_DMG}" "${DIST_DIR}/${ZIP_NAME}"
hdiutil create -quiet -fs APFS -format ULFO -volname Pointo -srcfolder "${DIST_DIR}/staging" "${DIST_DIR}/${DMG_NAME}"
codesign --force --timestamp --sign "${IDENTITY}" "${DIST_DIR}/${DMG_NAME}"

# Notarize only with a Developer ID identity and an App Store Connect API key of your own
# (POINTO_NOTARY_KEY_ID, POINTO_NOTARY_ISSUER, POINTO_NOTARY_KEY = path to the .p8). Without them the
# DMG is signed but not notarized, and first launch needs Control-click > Open.
if [[ -n "${POINTO_NOTARY_KEY_ID:-}" && -n "${POINTO_NOTARY_ISSUER:-}" && -f "${POINTO_NOTARY_KEY:-}" ]]; then
  xcrun notarytool submit "${DIST_DIR}/${DMG_NAME}" --key "${POINTO_NOTARY_KEY}" \
    --key-id "${POINTO_NOTARY_KEY_ID}" --issuer "${POINTO_NOTARY_ISSUER}" --wait --timeout 30m
  xcrun stapler staple "${DIST_DIR}/${DMG_NAME}"
  xcrun stapler staple "${APP_BUNDLE}"
  spctl -a -vv -t install "${DIST_DIR}/${DMG_NAME}"
else
  echo "note: not notarized (set POINTO_NOTARY_* with a Developer ID to notarize)" >&2
fi
cp -f "${DIST_DIR}/${DMG_NAME}" "${DIST_DIR}/${LATEST_DMG}"

/usr/bin/ditto -c -k --sequesterRsrc --keepParent "${APP_BUNDLE}" "${DIST_DIR}/${ZIP_NAME}"
cp -f "${DIST_DIR}/${ZIP_NAME}" "${UPDATES_DIR}/${ZIP_NAME}"

# Sparkle's EdDSA private key for Pointo: made once with `generate_keys --account pointo`, then
# exported with `generate_keys --account pointo -x "$SPARKLE_KEY_FILE"` (mode 600, never in the
# repo). Reading it from the keychain instead would stop at a keychain password prompt. Its public
# half is SPARKLE_PUBLIC_KEY above.
SPARKLE_KEY_FILE="${POINTO_SPARKLE_KEY_FILE:-${HOME}/.local/share/pointo-release/sparkle-ed25519.key}"
if [[ -f "${SPARKLE_KEY_FILE}" ]]; then
  "${SPARKLE_DIR}/bin/generate_appcast" \
    --ed-key-file "${SPARKLE_KEY_FILE}" \
    --download-url-prefix "${BASE_URL}/releases/" \
    "${UPDATES_DIR}"
else
  echo "warning: no Sparkle key at ${SPARKLE_KEY_FILE}; appcast not updated" >&2
fi

echo "Prepared ${DIST_DIR}/${DMG_NAME} and ${DIST_DIR}/${ZIP_NAME}"

if [[ -f "${UPDATES_DIR}/appcast.xml" ]]; then
  mkdir -p "${REPO_DIR}/site/public"
  cp -f "${UPDATES_DIR}/appcast.xml" "${REPO_DIR}/site/public/appcast.xml"
fi

# publish: a GitHub release v${VERSION} with the DMG, the stable-name DMG and the update zip.
# Commit and push site/public/appcast.xml afterwards so the Pages deploy serves the new feed.
if [[ "${MODE}" == "publish" ]]; then
  # POINTO_RELEASE_TARGET (a commit) makes the tag there when it doesn't exist yet.
  gh release create "v${VERSION}" --repo "${REPO_SLUG}" --title "Pointo ${VERSION}" \
    ${POINTO_RELEASE_TARGET:+--target "${POINTO_RELEASE_TARGET}"} \
    --notes-file "${POINTO_RELEASE_NOTES:-/dev/null}" \
    "${DIST_DIR}/${DMG_NAME}" "${DIST_DIR}/${LATEST_DMG}" "${DIST_DIR}/${ZIP_NAME}"
fi
