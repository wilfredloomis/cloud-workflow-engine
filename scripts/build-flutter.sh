#!/bin/bash
# Build Flutter APK
# Usage: ./build-flutter.sh /path/to/project [release|debug|profile]

set -e

PROJECT_DIR="${1:-.}"
BUILD_MODE="${2:-release}"

cd "$PROJECT_DIR" || exit 1

echo "=== Building Flutter APK (${BUILD_MODE}) ==="

flutter pub get

flutter build apk --${BUILD_MODE} --no-tree-shake-icons 2>&1 || \
flutter build apk --${BUILD_MODE} 2>&1

APK_PATH="build/app/outputs/flutter-apk/app-${BUILD_MODE}.apk"

if [ -f "$APK_PATH" ]; then
  echo "APK built successfully: $APK_PATH"
  echo "Size: $(du -h "$APK_PATH" | cut -f1)"
else
  echo "APK not found at expected path, searching..."
  find . -name "*.apk" -type f
fi
