#!/bin/bash
# Build Native Android APK
# Usage: ./build-native-android.sh /path/to/project [release|debug]

set -e

PROJECT_DIR="${1:-.}"
BUILD_MODE="${2:-release}"

cd "$PROJECT_DIR" || exit 1

echo "=== Building Native Android APK (${BUILD_MODE}) ==="

chmod +x gradlew 2>/dev/null || true

if [ "$BUILD_MODE" = "release" ]; then
  ./gradlew assembleRelease
else
  ./gradlew assembleDebug
fi

APK_PATH="app/build/outputs/apk/${BUILD_MODE}/app-${BUILD_MODE}.apk"

if [ -f "$APK_PATH" ]; then
  echo "APK built successfully: $APK_PATH"
  echo "Size: $(du -h "$APK_PATH" | cut -f1)"
else
  echo "APK not found at expected path, searching..."
  find . -name "*.apk" -type f
fi
