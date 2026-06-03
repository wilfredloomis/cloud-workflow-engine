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

# Pre-check: note whether gradle files exist (at root OR inside an android/
# subdirectory) so we can use this inside the package.json branch to avoid
# misclassifying workspace/tool package.json files as React Native.
HAS_GRADLE=false
if [ -f settings.gradle ] || [ -f settings.gradle.kts ] || \
   [ -f build.gradle ] || [ -f build.gradle.kts ] || \
   [ -f android/settings.gradle ] || [ -f android/settings.gradle.kts ] || \
   [ -f android/build.gradle ] || [ -f android/build.gradle.kts ]; then
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

  # React Native — must be identified by a real React Native dependency.
  # A bare "react"/"react-dom" web app is NOT React Native, and the mere
  # presence of an android/ or ios/ folder is NOT sufficient evidence either
  # (native Android, Capacitor, Cordova and TWA web projects all ship those
  # folders). Require the "react-native" package, the @react-native-community
  # /@react-native scoped packages, or the react-native CLI to be present.
  if grep -qE '"react-native"\s*:' package.json 2>/dev/null || \
     grep -qE '"@react-native(-community)?/' package.json 2>/dev/null; then
    echo "react_native"
    exit 0
  fi

  # If gradle/android files exist alongside an unrecognised (non-RN)
  # package.json it is a native Android project that happens to ship a
  # workspace/tooling package.json (or a web project wrapped for Android).
  if [ "$HAS_GRADLE" = "true" ] || [ -d android ]; then
    echo "native_android"
    exit 0
  fi

  # Unrecognised JS project (plain web app, library, etc.)
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
