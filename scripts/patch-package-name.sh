#!/bin/bash
# Patch Android package name in project files
# Usage: ./patch-package-name.sh /path/to/project new.package.name

set -e

PROJECT_DIR="${1:-.}"
NEW_PACKAGE="$2"

if [ -z "$NEW_PACKAGE" ]; then
  echo "Usage: $0 /path/to/project new.package.name"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "=== Patching package name to: ${NEW_PACKAGE} ==="

# Find AndroidManifest.xml
MANIFEST=""
if [ -f android/app/src/main/AndroidManifest.xml ]; then
  MANIFEST="android/app/src/main/AndroidManifest.xml"
elif [ -f app/src/main/AndroidManifest.xml ]; then
  MANIFEST="app/src/main/AndroidManifest.xml"
fi

if [ -n "$MANIFEST" ]; then
  OLD_PACKAGE=$(grep -oP 'package="[^"]*"' "$MANIFEST" | head -1 | grep -oP '"[^"]*"' | tr -d '"')
  if [ -n "$OLD_PACKAGE" ] && [ "$OLD_PACKAGE" != "$NEW_PACKAGE" ]; then
    echo "Replacing $OLD_PACKAGE with $NEW_PACKAGE in $MANIFEST"
    sed -i "s|package=\"$OLD_PACKAGE\"|package=\"$NEW_PACKAGE\"|g" "$MANIFEST"
  fi
fi

# Patch build.gradle
for GRADLE in android/app/build.gradle app/build.gradle; do
  if [ -f "$GRADLE" ]; then
    if grep -q "applicationId" "$GRADLE"; then
      echo "Patching applicationId in $GRADLE"
      sed -i "s|applicationId \"[^\"]*\"|applicationId \"$NEW_PACKAGE\"|g" "$GRADLE"
      sed -i "s|applicationId '[^']*'|applicationId '$NEW_PACKAGE'|g" "$GRADLE"
    fi
  fi
done

echo "Package name patched."
