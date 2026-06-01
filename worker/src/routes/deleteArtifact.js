import { jsonResponse, errorResponse } from '../utils/json.js';
import { deleteArtifact } from '../github.js';

async function handleDeleteArtifact(request, env) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get('artifact_id');

  if (!artifactId) {
    return errorResponse('Missing artifact_id parameter');
  }

  try {
    await deleteArtifact(env, artifactId);
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(
      `Failed to delete artifact: ${error.message}`,
      500
    );
  }
}

export { handleDeleteArtifact };
