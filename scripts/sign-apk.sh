#!/bin/bash
# Sign APK with keystore
# Usage: ./sign-apk.sh /path/to/apk /path/to/keystore keystore_password key_alias key_password

set -e

APK_PATH="$1"
KEYSTORE_PATH="$2"
KEYSTORE_PASSWORD="$3"
KEY_ALIAS="$4"
KEY_PASSWORD="$5"

if [ -z "$APK_PATH" ] || [ -z "$KEYSTORE_PATH" ]; then
  echo "Usage: $0 /path/to/apk /path/to/keystore keystore_password key_alias key_password"
  exit 1
fi

if [ ! -f "$APK_PATH" ]; then
  echo "ERROR: APK not found: $APK_PATH"
  exit 1
fi

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "ERROR: Keystore not found: $KEYSTORE_PATH"
  exit 1
fi

echo "=== Signing APK ==="
echo "APK: $APK_PATH"

# Find apksigner
APKSIGNER=$(command -v apksigner 2>/dev/null || find "${ANDROID_HOME:-/usr/local/lib/android/sdk}" -name "apksigner" -type f 2>/dev/null | head -1)

if [ -z "$APKSIGNER" ]; then
  echo "ERROR: apksigner not found"
  exit 1
fi

"$APKSIGNER" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-pass "pass:$KEYSTORE_PASSWORD" \
  --ks-key-alias "$KEY_ALIAS" \
  --key-pass "pass:$KEY_PASSWORD" \
  "$APK_PATH"

echo "APK signed successfully."

# Verify
"$APKSIGNER" verify "$APK_PATH" && echo "Signature verified." || echo "WARNING: Signature verification failed."
