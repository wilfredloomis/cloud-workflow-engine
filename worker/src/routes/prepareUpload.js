import { jsonResponse, errorResponse } from '../utils/json.js';

async function handlePrepareUpload(request, env) {
  const url = new URL(request.url);
  const ext = url.searchParams.get('ext') || 'zip';

  if (ext !== 'zip') {
    return errorResponse('Only ZIP files are supported');
  }

  const jobId = Date.now().toString();
  const assetName = `job_${jobId}.zip`;

  // Return an upload URL that points to this Worker's /upload endpoint
  const workerUrl = url.origin;
  const uploadUrl = `${workerUrl}/upload?job_id=${jobId}`;

  return jsonResponse({
    job_id: jobId,
    asset_name: assetName,
    upload_url: uploadUrl,
    upload_method: 'worker_proxy',
  });
}

export { handlePrepareUpload };
