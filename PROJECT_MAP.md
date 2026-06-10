# 🗺️ Project Map — Cloud Workflow Engine

> **Cloud APK Build Engine** — A Cloudflare Worker backend + GitHub Actions pipeline that lets a mobile app (Flutter client) upload source code and receive a compiled Android APK, without ever exposing GitHub credentials to the client.

---

## 1. High-Level Architecture

```
┌─────────────┐      ┌────────────────────┐      ┌─────────────────┐      ┌──────────────┐
│ Flutter App │ ───► │ Cloudflare Worker  │ ───► │ GitHub Actions  │ ───► │ APK Artifact │
│  (client)   │ ◄─── │  (API gateway)     │ ◄─── │ (build runner)  │ ◄─── │  (download)  │
└─────────────┘      └────────────────────┘      └─────────────────┘      └──────────────┘
```

**Build flow (end-to-end):**

1. Client calls `GET /prepare-upload` → receives `job_id` + `upload_url`
2. Client `POST /upload` with source ZIP → Worker proxies it to a GitHub Release asset
3. Client calls `/dispatch-job` → Worker triggers the `build-apk.yml` workflow via `workflow_dispatch`
4. Client polls `GET /status` or `GET /job-live` for progress (step-by-step detail)
5. On failure, client can fetch raw logs via `GET /logs`
6. On success, client gets `GET /artifact-info` then downloads the APK ZIP via `GET /artifact`
7. Client cleans up with `DELETE /delete-artifact`

**Security model:** the GitHub PAT lives only in Worker secrets and GitHub repo secrets — never reaches the mobile app. Uploads are capped at 100 MB, builds time out at 30 min, artifacts retain for 1 day and are deleted after download.

---

## 2. Directory Tree

```
/home/user/webapp/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions build pipeline (~26 steps)
│
├── worker/                        # Cloudflare Worker source
│   ├── package.json               # Worker-local package manifest (wrangler dev/deploy)
│   └── src/
│       ├── index.js               # Entry point — fetch handler & path router
│       ├── github.js              # GitHub REST API client (all GH calls live here)
│       ├── routes/                # One handler module per endpoint
│       │   ├── prepareUpload.js   # GET    /prepare-upload
│       │   ├── upload.js          # POST   /upload
│       │   ├── dispatchJob.js     # GET|POST /dispatch-job
│       │   ├── status.js          # GET    /status, GET /job-live
│       │   ├── logs.js            # GET    /logs
│       │   ├── artifact.js        # GET    /artifact-info, GET /artifact
│       │   └── deleteArtifact.js  # DELETE /delete-artifact
│       └── utils/
│           ├── cors.js            # CORS headers, preflight, withCors wrapper
│           ├── json.js            # jsonResponse / errorResponse helpers
│           └── errors.js          # AppError class + handleError
│
├── scripts/                       # Bash scripts executed inside the Actions runner
│   ├── detect-project.sh          # Auto-detect project type from source tree
│   ├── build-flutter.sh           # flutter pub get + flutter build apk
│   ├── build-react-native.sh      # npm install + gradlew assemble{Release|Debug}
│   ├── build-expo.sh              # npm install + expo prebuild + gradlew
│   ├── build-native-android.sh    # gradlew assemble{Release|Debug}
│   ├── build-capacitor.sh         # npm build + cap sync android + gradlew
│   ├── build-cordova.sh           # cordova platform add + cordova build android
│   ├── build-ionic.sh             # ionic build + cap/cordova android build
│   ├── patch-app-name.sh          # Rewrite Android app label in manifests/strings
│   ├── patch-package-name.sh      # Rewrite applicationId / package name
│   └── sign-apk.sh                # zipalign + apksigner with provided keystore
│
├── package.json                   # Root manifest — `npm run deploy` (wrangler ^4)
├── package-lock.json
├── wrangler.toml                  # Worker config: name, entry, secrets docs
├── .gitignore                     # node_modules, .wrangler, dist, logs
├── README.md                      # Setup, API table, security notes
└── PROJECT_MAP.md                 # ← this file
```

---

## 3. Component Reference

### 3.1 Cloudflare Worker (`worker/src/`)

#### `index.js` — Router (108 lines)
Single `fetch` handler with a `switch` on `url.pathname`. Responsibilities:
- CORS preflight handling (`OPTIONS` → 204)
- Method validation per route (405 otherwise)
- Health check at `/` and `/health` (returns service info + endpoint list)
- Wraps every response with `withCors()`; catches all errors via `handleError()`

#### `github.js` — GitHub API Client (299 lines)
All GitHub REST calls are centralized here. Exported functions:

| Function | Purpose |
|---|---|
| `githubFetch / githubJson` | Authenticated fetch wrappers (`token` auth, JSON parsing, error surface) |
| `triggerWorkflow(env, inputs)` | POST `workflow_dispatch` on `build-apk.yml` (ref: `main`) |
| `getLatestRun(env, jobId)` | Find the workflow run whose title contains the `job_id` |
| `getRunStatus(env, runId)` | Run-level status/conclusion |
| `getRunJobs(env, runId)` | Job + step details for progress reporting |
| `getJobLogs(env, jobId)` | Raw job log text (follows 301/302 redirect manually) |
| `getRunArtifacts(env, runId)` | List run artifacts |
| `downloadArtifact(env, artifactId)` | Stream artifact ZIP (manual redirect follow) |
| `deleteArtifact(env, artifactId)` | DELETE artifact (404 tolerated) |
| `resolveReleaseId(env)` | Use `GITHUB_RELEASE_ID`, or find/create prerelease tagged `cloud-build-storage` |
| `uploadReleaseAsset(env, name, data)` | Upload source ZIP to `uploads.github.com` |
| `getReleaseAssetUrl(env, assetId)` | Resolve direct asset download URL |

#### Routes (`worker/src/routes/`)

| File | Endpoint(s) | Behavior |
|---|---|---|
| `prepareUpload.js` | `GET /prepare-upload?ext=zip` | Generates `job_id` (timestamp), returns Worker-proxied `upload_url` |
| `upload.js` | `POST /upload?job_id=` | Accepts raw body or multipart; 100 MB cap; stores as `job_<id>.zip` release asset; returns `asset_id` + `source_url` |
| `dispatchJob.js` | `GET\|POST /dispatch-job` | Params: `job_id`, `app_name` (required), `package_name`, `flutter_version` (default `3.29.1`), `build_mode` (default `release`), `project_type` (default `auto`), `asset_id`/`source_url`. Triggers workflow then polls up to 4× to resolve `run_id` |
| `status.js` | `GET /status`, `GET /job-live` | Resolve run by `run_id` or `job_id`; returns status, conclusion, step progress (`current_step`/`total_steps`/`step_name`/`steps[]`), failed-step diagnostics. `/job-live` fetches run + jobs in parallel |
| `logs.js` | `GET /logs` | Resolves the failed (or first) workflow job and returns its full raw log text (`ready` flag for polling) |
| `artifact.js` | `GET /artifact-info`, `GET /artifact` | Looks up artifact named `<prefix>-<job_id>` (default prefix `apk`); info returns metadata, download streams the ZIP with `Content-Disposition` |
| `deleteArtifact.js` | `DELETE /delete-artifact?artifact_id=` | Deletes the artifact post-download |

#### Utils (`worker/src/utils/`)
- **`cors.js`** — `CORS_HEADERS` (origin `*`; GET/POST/DELETE/OPTIONS), `handleOptions()`, `withCors()`
- **`json.js`** — `jsonResponse(data, status)`, `errorResponse(message, status)` (shape: `{ error, ok: false }`)
- **`errors.js`** — `AppError(message, status)` custom class; `handleError()` maps to error responses, hides internals as 500

### 3.2 GitHub Actions Workflow (`.github/workflows/build-apk.yml`, 317 lines)

**Trigger:** `workflow_dispatch` with inputs `job_id`, `source_url`/`asset_id`, `app_name`, `package_name`, `flutter_version`, `build_mode`, `project_type`.
**Runner:** `ubuntu-latest`, 30-minute timeout. **Run name:** `Build <job_id> - <app_name>` (this is how the Worker matches runs to jobs).

Pipeline stages:

1. **Setup** — checkout, chmod scripts, apt deps (`unzip zip curl jq`), Java 17 (Temurin)
2. **Source acquisition** — download ZIP via authenticated release-asset API (`asset_id`) or plain `source_url`; extract to `project/`, flattening a single nested directory if present
3. **Project detection** — explicit `project_type` input or `scripts/detect-project.sh`
4. **Toolchain setup (conditional)** — Flutter SDK (subosito/flutter-action) for Flutter; Node 20 for RN/Expo/Capacitor/Cordova/Ionic; Android SDK (platforms 34/35, build-tools 34/35, auto-NDK if `ndkVersion` referenced)
5. **Caching** — Gradle caches/wrapper, Flutter pub-cache, npm cache (keyed by OS + job_id, with restore-keys fallback)
6. **Patching** — gradle.properties CI fixes (`-Xmx4096m`, AndroidX/Jetifier), package-name patch (if provided), app-name patch, gradlew chmod, http→https gradle wrapper URL fix
7. **Build** — dispatch to the matching `scripts/build-*.sh`
8. **Signing** — decode `KEYSTORE_BASE64` and run `sign-apk.sh` (non-fatal on failure → unsigned APK)
9. **Artifact** — find best APK (prefer non-`unsigned`), rename to `<SafeAppName>_<mode>.apk`, upload as artifact `apk-<job_id>` (retention: 1 day), print build summary

### 3.3 Build Scripts (`scripts/`)

| Script | Type | Strategy |
|---|---|---|
| `detect-project.sh` | detection | Priority: `pubspec.yaml` → flutter; root Gradle files → native_android; then `package.json` heuristics: expo → capacitor → cordova → ionic → react_native (dep or `android`/`ios` dirs); else `unknown` (exit 1) |
| `build-flutter.sh` | flutter | `flutter pub get` → `flutter build apk --<mode>` (retries without `--no-tree-shake-icons`) |
| `build-react-native.sh` | react_native | `npm install` → `android/gradlew assemble<Mode>` |
| `build-expo.sh` | expo | `npm install` → `npx expo prebuild --platform android` → gradlew |
| `build-native-android.sh` | native_android | gradlew at root or `android/` → `assemble<Mode>` |
| `build-capacitor.sh` | capacitor | `npm install` → `npm run build` → `npx cap sync android` → gradlew |
| `build-cordova.sh` | cordova | `npm install` → `cordova platform add android` → `cordova build android` |
| `build-ionic.sh` | ionic | ionic build then capacitor/cordova android build path |
| `patch-app-name.sh` | patch | Rewrites app display name across Android manifests/resources |
| `patch-package-name.sh` | patch | Rewrites `applicationId`/package (incl. `.kts` support) |
| `sign-apk.sh` | signing | Signs the built APK with the provided keystore credentials |

---

## 4. API Endpoint Summary

| Method | Path | Key Params | Returns |
|--------|------|-----------|---------|
| `GET` | `/` , `/health` | — | Service info + endpoint list |
| `GET` | `/prepare-upload` | `ext` (zip only) | `job_id`, `asset_name`, `upload_url` |
| `POST` | `/upload` | `job_id`; body = ZIP (raw or multipart) | `asset_id`, `source_url` |
| `GET\|POST` | `/dispatch-job` | `job_id`, `app_name`, `package_name?`, `flutter_version?`, `build_mode?`, `project_type?`, `asset_id?`/`source_url?` | `run_id`, `run_number` |
| `GET` | `/status` | `run_id` or `job_id` | status, conclusion, step progress, error detail |
| `GET` | `/job-live` | `run_id` or `job_id` | Same as status, run+jobs fetched in parallel |
| `GET` | `/logs` | `run_id` or `job_id` | Raw job log text, `ready` flag |
| `GET` | `/artifact-info` | `run_id`, `job_id`, `prefix?` | `artifact_id`, name, size, timestamps |
| `GET` | `/artifact` | `run_id`, `job_id`, `prefix?` | APK ZIP stream (attachment) |
| `DELETE` | `/delete-artifact` | `artifact_id` | `{ ok: true }` |

Error shape (all endpoints): `{ "error": "<message>", "ok": false }` with appropriate HTTP status (400/404/405/413/500).

---

## 5. Configuration & Secrets

### Cloudflare Worker (`wrangler secret put …`)
| Secret | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | PAT with `repo` + `actions` scope |
| `GITHUB_OWNER` | ✅ | Repo owner/org |
| `GITHUB_REPO` | ✅ | Repo name (`cloud-workflow-engine`) |
| `GITHUB_WORKFLOW_ID` | optional | Defaults to `build-apk.yml` |
| `GITHUB_RELEASE_ID` | optional | Source-ZIP storage release; auto-created prerelease `cloud-build-storage` if absent |
| `GITHUB_RELEASE_TAG` | optional | Fallback tag for the auto-created storage release |

`wrangler.toml`: name `cloud-workflow-engine`, entry `worker/src/index.js`, `[vars] ENVIRONMENT = "production"`.

### GitHub Repository Secrets
| Secret | Required | Purpose |
|---|---|---|
| `GH_PAT` | ✅ | Used by the workflow to download the release asset |
| `KEYSTORE_BASE64` | optional | Base64 release keystore for APK signing |
| `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` | optional | Signing credentials |

---

## 6. Supported Project Types

| Type | Detection Signal | Build Path |
|------|------------------|-----------|
| Flutter | `pubspec.yaml` | `flutter build apk` |
| Native Android | root Gradle files (`settings.gradle[.kts]`, `build.gradle[.kts]`, `gradlew`) | `./gradlew assembleRelease` |
| Expo | `"expo"` in `package.json` | `expo prebuild` + gradlew |
| Capacitor | `@capacitor/core\|android` dep | `cap sync` + gradlew |
| Cordova | `cordova-android` dep | `cordova build android` |
| Ionic | `ionic.config.json` or `@ionic/*` dep | ionic + cap/cordova build |
| React Native | `react-native` dep, or `android`/`ios` dirs | gradlew via `android/` |

Detection priority matters: Flutter and root-Gradle checks run **before** `package.json` heuristics (avoids misclassifying native projects that ship helper `package.json` files).

---

## 7. Development & Deployment

```bash
# Local dev (worker dir has its own scripts)
cd worker && npm install && npx wrangler dev

# Deploy (from repo root, uses wrangler.toml)
npm install
npm run deploy        # = wrangler deploy
```

**Git layout:** `main` is the deployed branch; feature work flows through `genspark_ai_developer` (and historical `devin/*` branches) via PRs.
**Remote:** `https://github.com/wilfredloomis/cloud-workflow-engine`

---

## 8. Code Statistics

| Area | Files | Lines |
|---|---|---|
| Worker JS (`worker/src/`) | 12 | ~1,024 |
| Build scripts (`scripts/`) | 11 | ~435 |
| GitHub Actions workflow | 1 | 317 |
| **Total source** | **24** | **~1,776** |

---

## 9. Key Design Decisions

- **Worker as token-hiding proxy** — the mobile client never sees `GITHUB_TOKEN`; even artifact downloads are streamed through the Worker.
- **GitHub Releases as upload storage** — avoids needing R2/S3; a dedicated prerelease (`cloud-build-storage`) holds `job_<id>.zip` assets.
- **Run matching by `job_id` in run title** — `run-name: Build ${{ inputs.job_id }} - …` lets the Worker find the run without persisting state (the Worker is fully stateless; no KV/D1).
- **Manual redirect handling** — GitHub artifact/log endpoints return 302s with pre-signed URLs that must be fetched *without* the auth header; `github.js` follows them manually.
- **Graceful degradation** — step info is optional in `/status`; signing failures fall back to unsigned APKs; NDK install and license acceptance tolerate errors.
- **Auto-detection with explicit override** — `project_type=auto` runs `detect-project.sh`, but clients can force a type.
