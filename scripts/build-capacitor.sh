#!/bin/bash
# Build Capacitor APK
# Usage: ./build-capacitor.sh /path/to/project [release|debug]

set -e

PROJECT_DIR="${1:-.}"
BUILD_MODE="${2:-release}"

cd "$PROJECT_DIR" || exit 1

echo "=== Building Capacitor APK (${BUILD_MODE}) ==="

npm install
npm run build || true
npx cap sync android

cd android
chmod +x gradlew

if [ "$BUILD_MODE" = "release" ]; then
  ./gradlew assembleRelease
else
  ./gradlew assembleDebug
fi

find . -name "*.apk" -type f
