import { jsonResponse, errorResponse } from '../utils/json.js';
import { getRunArtifacts, downloadArtifact } from '../github.js';
import { CORS_HEADERS } from '../utils/cors.js';

async function handleArtifactInfo(request, env) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const jobId = url.searchParams.get('job_id');
  const prefix = url.searchParams.get('prefix') || 'apk';

  if (!runId) return errorResponse('Missing run_id parameter');
  if (!jobId) return errorResponse('Missing job_id parameter');

  try {
    const data = await getRunArtifacts(env, runId);
    const targetName = `${prefix}-${jobId}`;

    const artifact = data.artifacts.find((a) => a.name === targetName);

    if (!artifact) {
      return errorResponse(
        `Artifact "${targetName}" not found. Available: ${data.artifacts.map((a) => a.name).join(', ')}`,
        404
      );
    }

    const digest = artifact.digest || '';
    const sha256 = digest.startsWith('sha256:') ? digest.slice(7) : digest;
    if (!/^[a-f0-9]{64}$/i.test(sha256)) {
      return errorResponse('Artifact SHA-256 digest is unavailable', 503);
    }

    return jsonResponse({
      artifact_id: artifact.id,
      name: artifact.name,
      size_in_bytes: artifact.size_in_bytes,
      created_at: artifact.created_at,
      expires_at: artifact.expires_at,
      sha256: sha256.toLowerCase(),
    });
  } catch (error) {
    return errorResponse(`Failed to get artifact info: ${error.message}`, 500);
  }
}

async function handleArtifactDownload(request, env) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const jobId = url.searchParams.get('job_id');
  const prefix = url.searchParams.get('prefix') || 'apk';

  if (!runId) return errorResponse('Missing run_id parameter');
  if (!jobId) return errorResponse('Missing job_id parameter');

  try {
    // First get artifact ID
    const data = await getRunArtifacts(env, runId);
    const targetName = `${prefix}-${jobId}`;
    const artifact = data.artifacts.find((a) => a.name === targetName);

    if (!artifact) {
      return errorResponse(`Artifact "${targetName}" not found`, 404);
    }

    // Download artifact ZIP
    const response = await downloadArtifact(
      env,
      artifact.id,
      request.headers.get('Range')
    );

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${targetName}.zip"`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      ...CORS_HEADERS,
    });
    for (const name of ['Content-Length', 'Content-Range', 'ETag']) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return errorResponse(
      `Failed to download artifact: ${error.message}`,
      500
    );
  }
}

export { handleArtifactInfo, handleArtifactDownload };
