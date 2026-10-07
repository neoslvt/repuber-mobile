#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required." >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 or newer is required (current: $(node -v))." >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "A JDK (17 or newer) is required. Install it and make sure java is on PATH." >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  else
    echo "Set ANDROID_HOME to your Android SDK path." >&2
    exit 1
  fi
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

if [ ! -d node_modules ]; then
  npm install
fi

echo "Generating the Android project from app.json..."
npx expo prebuild --platform android --no-install

echo "Compiling the release APK..."
(cd android && ./gradlew assembleRelease)

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/repuber.apk
echo "APK written to $(pwd)/dist/repuber.apk"
