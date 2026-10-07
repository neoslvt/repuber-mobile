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

# Expo SDK 57 local Android builds need JDK 17, including javac.
# `java` on PATH may be a newer JRE (this machine defaults to OpenJDK 25 JRE),
# which Gradle rejects: the toolchain has no JAVA_COMPILER capability.
select_jdk17() {
  local candidate candidates=()

  if [ -n "${JAVA_HOME:-}" ]; then
    candidates+=("$JAVA_HOME")
  fi

  candidates+=(
    /usr/lib/jvm/java-17-openjdk-amd64
    /usr/lib/jvm/java-17-openjdk-arm64
    /usr/lib/jvm/openjdk-17
  )

  if [ -d /usr/lib/jvm ]; then
    while IFS= read -r candidate; do
      candidates+=("$candidate")
    done < <(find /usr/lib/jvm -maxdepth 1 -type d -name 'java-17*' -print 2>/dev/null || true)
  fi

  local seen=" "
  for candidate in "${candidates[@]}"; do
    [ -n "$candidate" ] || continue
    case "$seen" in
      *" $candidate "*) continue ;;
    esac
    seen="$seen$candidate "
    if [ ! -x "$candidate/bin/javac" ]; then
      continue
    fi
    version="$("$candidate/bin/java" -version 2>&1 || true)"
    case "$version" in
      *'version "17.'*)
        printf '%s\n' "$candidate"
        return 0
        ;;
    esac
  done
  return 1
}

jdk17="$(select_jdk17)" || {
  echo "JDK 17 with javac is required for the Android build." >&2
  echo "Install it (for example: sudo apt install openjdk-17-jdk) and retry." >&2
  exit 1
}
export JAVA_HOME="$jdk17"
export PATH="$JAVA_HOME/bin:$PATH"
echo "Using JDK 17 at $JAVA_HOME"

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
