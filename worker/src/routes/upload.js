import { jsonResponse, errorResponse } from '../utils/json.js';
import { uploadReleaseAsset } from '../github.js';
import { AppError } from '../utils/errors.js';

const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

async function handleUpload(request, env) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('job_id');

  if (!jobId) {
    return errorResponse('Missing job_id parameter');
  }

  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_SIZE) {
    return errorResponse(`File too large. Maximum size is ${MAX_SIZE / 1024 / 1024} MB`, 413);
  }

  let fileData;
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return errorResponse('No file found in upload');
    }
    fileData = await file.arrayBuffer();
  } else {
    fileData = await request.arrayBuffer();
  }

  if (!fileData || fileData.byteLength === 0) {
    return errorResponse('Empty file');
  }

  if (fileData.byteLength > MAX_SIZE) {
    return errorResponse(`File too large. Maximum size is ${MAX_SIZE / 1024 / 1024} MB`, 413);
  }

  try {
    const fileName = `job_${jobId}.zip`;
    const asset = await uploadReleaseAsset(env, fileName, fileData);

    return jsonResponse({
      ok: true,
      job_id: jobId,
      asset_id: asset.id,
      source_url: asset.browser_download_url,
    });
  } catch (error) {
    throw new AppError(`Upload failed: ${error.message}`, 500);
  }
}

export { handleUpload };
