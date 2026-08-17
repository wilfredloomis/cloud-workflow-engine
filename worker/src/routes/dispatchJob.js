import { jsonResponse, errorResponse } from '../utils/json.js';
import { triggerWorkflow, getLatestRun } from '../github.js';
import { AppError } from '../utils/errors.js';

async function waitForRun(env, jobId, attempts = 4, delayMs = 1500) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const run = await getLatestRun(env, jobId);
    if (run) return run;
  }

  return null;
}

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

  try {
    const existingRun = await getLatestRun(env, job_id);
    if (existingRun) {
      return jsonResponse({
        ok: true,
        job_id,
        run_id: String(existingRun.id),
        run_number: existingRun.run_number,
        resumed: true,
      });
    }

    await triggerWorkflow(env, {
      job_id,
      source_url: source_url || '',
      asset_id: asset_id ? String(asset_id) : '',
      app_name,
      package_name,
      flutter_version,
      build_mode,
      project_type,
    });

    const run = await waitForRun(env, job_id);

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
