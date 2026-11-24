#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$ROOT/.android-sdk}}"

if [[ ! -d "$SDK" ]]; then
  echo "Android SDK not found at: $SDK" >&2
  exit 1
fi

if [[ -d "$SDK/build-tools/35.0.0" ]]; then
  BUILD_TOOLS="$SDK/build-tools/35.0.0"
else
  BUILD_TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -n 1)"
fi

ANDROID_JAR="$SDK/platforms/android-35/android.jar"
if [[ ! -f "$ANDROID_JAR" ]]; then
  echo "Missing Android platform jar: $ANDROID_JAR" >&2
  exit 1
fi
if [[ -z "${BUILD_TOOLS:-}" || ! -x "$BUILD_TOOLS/aapt2" ]]; then
  echo "Missing Android build-tools (aapt2) under: $SDK/build-tools" >&2
  exit 1
fi

PROJECT="$ROOT/android"
BUILD_DIR="$PROJECT/build"
CLASSES="$BUILD_DIR/classes"
OUTPUT="$ROOT/dist"
UNSIGNED="$BUILD_DIR/express-pickup-unsigned.apk"
UNALIGNED="$BUILD_DIR/express-pickup-unaligned.apk"

VERSION_NAME="$(python3 -c "import re, pathlib; m = re.search(r'android:versionName=\"([^\"]+)\"', pathlib.Path('$PROJECT/AndroidManifest.xml').read_text(encoding='utf-8')); print(m.group(1) if m else '1.0.0')")"
VERSION_CODE="$(python3 -c "import re, pathlib; m = re.search(r'android:versionCode=\"([^\"]+)\"', pathlib.Path('$PROJECT/AndroidManifest.xml').read_text(encoding='utf-8')); print(m.group(1) if m else '1')")"

APK_VERSIONED="$OUTPUT/yiqujian-v${VERSION_NAME}.apk"
APK_COMPAT="$OUTPUT/express-pickup.apk"

echo "Building 易取件 v${VERSION_NAME} (versionCode=${VERSION_CODE}) with $(basename "$BUILD_TOOLS")..."

python3 "$ROOT/sync-android.py"
rm -rf "$CLASSES" "$BUILD_DIR/resources.zip" "$UNSIGNED" "$UNALIGNED"
mkdir -p "$CLASSES" "$OUTPUT" "$BUILD_DIR"

"$BUILD_TOOLS/aapt2" compile --dir "$PROJECT/res" -o "$BUILD_DIR/resources.zip"
"$BUILD_TOOLS/aapt2" link \
  -o "$UNSIGNED" \
  -I "$ANDROID_JAR" \
  --manifest "$PROJECT/AndroidManifest.xml" \
  --java "$BUILD_DIR" \
  --min-sdk-version 26 \
  --target-sdk-version 35 \
  "$BUILD_DIR/resources.zip"

JAVA_SOURCES=("$BUILD_DIR/com/express/pickup/R.java" "$PROJECT"/src/com/express/pickup/*.java)
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$CLASSES" "${JAVA_SOURCES[@]}"

"$BUILD_TOOLS/d8" --lib "$ANDROID_JAR" --output "$BUILD_DIR" "$CLASSES"/com/express/pickup/*.class

python3 "$ROOT/pack-android.py" "$PROJECT" "$UNSIGNED"
"$BUILD_TOOLS/zipalign" -f -p 4 "$UNSIGNED" "$UNALIGNED"

KEYSTORE_PATH="${ANDROID_KEYSTORE_PATH:-$PROJECT/express-pickup.keystore}"
SIGNING_MODE="release"

if [[ -f "$KEYSTORE_PATH" ]]; then
  KS_PASS="${ANDROID_KEYSTORE_PASSWORD:-express-pickup-local}"
  KEY_PASS="${ANDROID_KEY_PASSWORD:-$KS_PASS}"
  KEY_ALIAS="${ANDROID_KEY_ALIAS:-}"
else
  SIGNING_MODE="ephemeral"
  KEYSTORE_PATH="$BUILD_DIR/ci-ephemeral.keystore"
  KS_PASS="ephemeral-build-pass"
  KEY_PASS="$KS_PASS"
  KEY_ALIAS="yiqujian-ci"
  rm -f "$KEYSTORE_PATH"
  echo "No release keystore found; generating an ephemeral signing keystore for CI/fork build."
  keytool -genkeypair -noprompt \
    -keystore "$KEYSTORE_PATH" \
    -storetype PKCS12 \
    -storepass "$KS_PASS" \
    -keypass "$KEY_PASS" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Yiqujian CI, OU=Build, O=Yiqujian, L=Local, ST=Local, C=CN"
fi

SIGN_ARGS=(
  sign
  --ks "$KEYSTORE_PATH"
  --ks-pass "pass:$KS_PASS"
  --key-pass "pass:$KEY_PASS"
  --out "$APK_VERSIONED"
)
if [[ -n "$KEY_ALIAS" ]]; then
  SIGN_ARGS+=(--ks-key-alias "$KEY_ALIAS")
fi
SIGN_ARGS+=("$UNALIGNED")

"$BUILD_TOOLS/apksigner" "${SIGN_ARGS[@]}"
"$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$APK_VERSIONED"

cp "$APK_VERSIONED" "$APK_COMPAT"
(cd "$OUTPUT" && sha256sum "$(basename "$APK_VERSIONED")" > "$(basename "$APK_VERSIONED").sha256")

APK_SHA256="$(awk '{print $1}' "${APK_VERSIONED}.sha256")"
APK_SIZE="$(wc -c < "$APK_VERSIONED" | tr -d ' ')"

echo "APK created: $APK_VERSIONED (${APK_SIZE} bytes, sha256=${APK_SHA256}, signing=${SIGNING_MODE})"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "version_name=${VERSION_NAME}"
    echo "version_code=${VERSION_CODE}"
    echo "apk_filename=$(basename "$APK_VERSIONED")"
    echo "apk_path=${APK_VERSIONED}"
    echo "sha256_path=${APK_VERSIONED}.sha256"
    echo "apk_sha256=${APK_SHA256}"
    echo "apk_size=${APK_SIZE}"
    echo "signing_mode=${SIGNING_MODE}"
  } >> "$GITHUB_OUTPUT"
fi
