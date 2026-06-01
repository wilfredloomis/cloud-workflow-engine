#!/bin/bash
# Detect project type from extracted source directory
# Usage: ./detect-project.sh /path/to/project

PROJECT_DIR="${1:-.}"

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: Directory not found: $PROJECT_DIR"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

if [ -f pubspec.yaml ]; then
  echo "flutter"
  exit 0
fi

if [ -f package.json ]; then
  if grep -q '"expo"' package.json 2>/dev/null; then
    echo "expo"
    exit 0
  fi
  if grep -q '"react-native"' package.json 2>/dev/null; then
    echo "react_native"
    exit 0
  fi
  echo "react_native"
  exit 0
fi

if [ -f settings.gradle ] || [ -f settings.gradle.kts ] || \
   [ -f build.gradle ] || [ -f build.gradle.kts ]; then
  echo "native_android"
  exit 0
fi

echo "unknown"
exit 1
