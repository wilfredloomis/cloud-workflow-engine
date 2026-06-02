import { jsonResponse, errorResponse } from '../utils/json.js';
import { triggerWorkflow, getLatestRun, getReleaseAssetUrl } from '../github.js';
import { AppError } from '../utils/errors.js';

async function handleDispatchJob(request, env) {
  let params;

  if (request.method === 'POST') {
    params = await request.json();
  } else {
    const url = new URL(request.url);
    params = Object.fromEntries(url.searchParams.entries());
  }

  const {
    job_id,
    app_name,
    package_name = '',
    flutter_version = '3.29.1',
    build_mode = 'release',
    project_type = 'auto',
    asset_id,
    source_url,
  } = params;

  if (!job_id) return errorResponse('Missing job_id');
  if (!app_name) return errorResponse('Missing app_name');

  // Build source URL from asset_id if not provided directly
  let resolvedSourceUrl = source_url || '';
  if (!resolvedSourceUrl && asset_id) {
    try {
      resolvedSourceUrl = await getReleaseAssetUrl(env, asset_id);
    } catch (error) {
      // Fallback: construct URL directly
      const owner = env.GITHUB_OWNER;
      const repo = env.GITHUB_REPO;
      resolvedSourceUrl = `https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset_id}`;
    }
  }

  try {
    await triggerWorkflow(env, {
      job_id,
      source_url: resolvedSourceUrl,
      asset_id: asset_id ? String(asset_id) : '',
      app_name,
      package_name,
      flutter_version,
      build_mode,
      project_type,
    });

    // Wait briefly and then try to get the run ID
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const run = await getLatestRun(env, job_id);

    return jsonResponse({
      ok: true,
      job_id,
      run_id: run ? String(run.id) : null,
      run_number: run ? run.run_number : null,
    });
  } catch (error) {
    throw new AppError(`Failed to dispatch build: ${error.message}`, 500);
  }
}

export { handleDispatchJob };
