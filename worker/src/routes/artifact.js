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

    return jsonResponse({
      artifact_id: artifact.id,
      name: artifact.name,
      size_in_bytes: artifact.size_in_bytes,
      created_at: artifact.created_at,
      expires_at: artifact.expires_at,
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
    const response = await downloadArtifact(env, artifact.id);

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${targetName}.zip"`,
      ...CORS_HEADERS,
    });

    return new Response(response.body, {
      status: 200,
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
