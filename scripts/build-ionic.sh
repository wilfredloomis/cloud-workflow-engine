#!/bin/bash
# Build Ionic APK
# Usage: ./build-ionic.sh /path/to/project [release|debug]

set -e

PROJECT_DIR="${1:-.}"
BUILD_MODE="${2:-release}"

cd "$PROJECT_DIR" || exit 1

echo "=== Building Ionic APK (${BUILD_MODE}) ==="

npm install
npm run build

if [ -f capacitor.config.ts ] || [ -f capacitor.config.js ] || [ -f capacitor.config.json ]; then
  npx cap sync android
  cd android
  chmod +x gradlew
  if [ "$BUILD_MODE" = "release" ]; then
    ./gradlew assembleRelease
  else
    ./gradlew assembleDebug
  fi
else
  npx cordova platform add android || true
  if [ "$BUILD_MODE" = "release" ]; then
    npx cordova build android --release
  else
    npx cordova build android --debug
  fi
fi

find . -name "*.apk" -type f
