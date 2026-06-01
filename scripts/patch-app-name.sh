#!/bin/bash
# Patch Android app display name
# Usage: ./patch-app-name.sh /path/to/project "New App Name"

set -e

PROJECT_DIR="${1:-.}"
NEW_NAME="$2"

if [ -z "$NEW_NAME" ]; then
  echo "Usage: $0 /path/to/project \"New App Name\""
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "=== Patching app name to: ${NEW_NAME} ==="

# Find strings.xml
STRINGS=""
if [ -f android/app/src/main/res/values/strings.xml ]; then
  STRINGS="android/app/src/main/res/values/strings.xml"
elif [ -f app/src/main/res/values/strings.xml ]; then
  STRINGS="app/src/main/res/values/strings.xml"
fi

if [ -n "$STRINGS" ]; then
  echo "Patching app_name in $STRINGS"
  sed -i "s|<string name=\"app_name\">[^<]*</string>|<string name=\"app_name\">${NEW_NAME}</string>|g" "$STRINGS"
fi

# Patch AndroidManifest.xml label
for MANIFEST in android/app/src/main/AndroidManifest.xml app/src/main/AndroidManifest.xml; do
  if [ -f "$MANIFEST" ]; then
    if grep -q 'android:label=' "$MANIFEST"; then
      echo "Patching android:label in $MANIFEST"
      sed -i "s|android:label=\"[^\"]*\"|android:label=\"${NEW_NAME}\"|g" "$MANIFEST"
    fi
  fi
done

echo "App name patched."
