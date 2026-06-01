# Cloud Workflow Engine

Cloudflare Worker backend + GitHub Actions for the Cloud APK Build Engine.

## Architecture

```
Flutter App → Cloudflare Worker → GitHub Actions → APK Artifact → Flutter App
```

The Worker acts as an API gateway that:
1. Generates job IDs and upload URLs
2. Proxies source ZIP uploads to GitHub Releases
3. Triggers GitHub Actions `workflow_dispatch`
4. Polls GitHub Actions run status and job steps
5. Downloads and proxies artifact ZIPs
6. Deletes artifacts after download
7. Hides the GitHub token from the mobile app

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/prepare-upload` | Get job ID and upload URL |
| `POST` | `/upload` | Upload source ZIP (proxied to GitHub Release) |
| `GET\|POST` | `/dispatch-job` | Trigger GitHub Actions build |
| `GET` | `/status` | Check build run status |
| `GET` | `/job-live` | Get live job status with step details |
| `GET` | `/artifact-info` | Get artifact metadata |
| `GET` | `/artifact` | Download artifact ZIP |
| `DELETE` | `/delete-artifact` | Delete artifact after download |

## Setup

### 1. GitHub Secrets

Add these secrets to your GitHub repository:

- `GH_PAT` — GitHub PAT with `repo` and `actions` scope
- `KEYSTORE_BASE64` — Base64-encoded release keystore (optional)
- `KEYSTORE_PASSWORD` — Keystore password (optional)
- `KEY_ALIAS` — Key alias (optional)
- `KEY_PASSWORD` — Key password (optional)

### 2. Cloudflare Worker

Set these secrets via `wrangler secret put`:

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_OWNER
wrangler secret put GITHUB_REPO
wrangler secret put GITHUB_WORKFLOW_ID
wrangler secret put GITHUB_RELEASE_ID
```

### 3. Deploy

```bash
cd worker
npm install
wrangler deploy
```

## Project Structure

```
.github/workflows/
  build-apk.yml          # GitHub Actions workflow (26 steps)

worker/
  src/
    index.js             # Worker entry point & router
    github.js            # GitHub API helper functions
    routes/
      prepareUpload.js   # POST /prepare-upload
      upload.js          # POST /upload
      dispatchJob.js     # POST /dispatch-job
      status.js          # GET /status, GET /job-live
      artifact.js        # GET /artifact-info, GET /artifact
      deleteArtifact.js  # DELETE /delete-artifact
    utils/
      cors.js            # CORS headers
      json.js            # JSON response helpers
      errors.js          # Error handling
  wrangler.toml
  package.json

scripts/
  detect-project.sh      # Detect project type from source
  build-flutter.sh       # Build Flutter APK
  build-react-native.sh  # Build React Native APK
  build-expo.sh          # Build Expo APK
  build-native-android.sh # Build Native Android APK
  patch-package-name.sh  # Patch Android package name
  patch-app-name.sh      # Patch Android app name
  sign-apk.sh            # Sign APK with keystore
```

## Supported Project Types

| Type | Detection | Build Command |
|------|-----------|---------------|
| Flutter | `pubspec.yaml` | `flutter build apk` |
| React Native | `package.json` + `react-native` | `./gradlew assembleRelease` |
| Expo | `package.json` + `expo` | `expo prebuild` + `./gradlew` |
| Native Android | `build.gradle` / `settings.gradle` | `./gradlew assembleRelease` |

## Security

- GitHub token is never exposed to the mobile app
- Source ZIPs are size-limited (100 MB)
- Builds run in isolated GitHub Actions runners
- Artifacts are auto-deleted after download
- Build timeout: 30 minutes
