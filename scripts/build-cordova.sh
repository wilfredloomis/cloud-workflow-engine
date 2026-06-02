#!/bin/bash
# Build Cordova APK
# Usage: ./build-cordova.sh /path/to/project [release|debug]

set -e

PROJECT_DIR="${1:-.}"
BUILD_MODE="${2:-release}"

cd "$PROJECT_DIR" || exit 1

echo "=== Building Cordova APK (${BUILD_MODE}) ==="

npm install
npx cordova platform add android || true

if [ "$BUILD_MODE" = "release" ]; then
  npx cordova build android --release
else
  npx cordova build android --debug
fi

find . -name "*.apk" -type f
