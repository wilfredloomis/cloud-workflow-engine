#!/bin/bash
# Detect project type from extracted source directory
# Usage: ./detect-project.sh /path/to/project

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: Directory not found: $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# Flutter — pubspec.yaml is unambiguous
if [ -f pubspec.yaml ]; then
  echo "flutter"
  exit 0
fi

# Pre-check: note whether gradle files exist at root so we can use this
# inside the package.json branch to avoid misclassifying workspace/tool
# package.json files as React Native.
HAS_GRADLE=false
if [ -f settings.gradle ] || [ -f settings.gradle.kts ] || \
   [ -f build.gradle ] || [ -f build.gradle.kts ]; then
  HAS_GRADLE=true
fi

if [ -f package.json ]; then
  # Expo — match "expo": in dependencies/devDependencies
  if grep -qE '"expo"\s*:' package.json 2>/dev/null; then
    echo "expo"
    exit 0
  fi

  # Capacitor — @capacitor/core or @capacitor/android
  if grep -qE '"@capacitor/(core|android)"' package.json 2>/dev/null; then
    echo "capacitor"
    exit 0
  fi

  # Cordova
  if grep -q '"cordova-android"' package.json 2>/dev/null; then
    echo "cordova"
    exit 0
  fi

  # Ionic — config file OR @ionic/* packages
  if [ -f ionic.config.json ] || grep -q '"@ionic/' package.json 2>/dev/null; then
    echo "ionic"
    exit 0
  fi

  # React Native — explicit dependency OR presence of android/ios directories
  if grep -qE '"react-native"\s*:' package.json 2>/dev/null || \
     [ -d android ] || [ -d ios ]; then
    echo "react_native"
    exit 0
  fi

  # If gradle files also exist alongside an unrecognised package.json it is a
  # native Android project that happens to have a workspace/tooling package.json.
  if [ "$HAS_GRADLE" = "true" ]; then
    echo "native_android"
    exit 0
  fi

  # Unrecognised JS project
  echo "unknown"
  exit 1
fi

if [ -f ionic.config.json ]; then
  echo "ionic"
  exit 0
fi

if [ "$HAS_GRADLE" = "true" ]; then
  echo "native_android"
  exit 0
fi

echo "unknown"
exit 1
