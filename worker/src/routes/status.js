import { jsonResponse, errorResponse } from '../utils/json.js';
import { getLatestRun, getRunStatus, getRunJobs } from '../github.js';

async function resolveRun(request, env) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const jobId = url.searchParams.get('job_id');

  if (runId) {
    return { runId, jobId };
  }

  if (!jobId) {
    return null;
  }

  const run = await getLatestRun(env, jobId);
  if (!run) {
    return { runId: null, jobId };
  }

  return { runId: String(run.id), jobId };
}

async function handleStatus(request, env) {
  const resolved = await resolveRun(request, env);

  if (!resolved) {
    return errorResponse('Missing run_id or job_id parameter');
  }

  if (!resolved.runId) {
    return jsonResponse({
      run_id: null,
      status: 'queued',
      conclusion: null,
      run_number: null,
      current_step: null,
      total_steps: null,
      step_name: 'Waiting for workflow run',
      steps: [],
      error: null,
    });
  }

  try {
    const runId = resolved.runId;
    const run = await getRunStatus(env, runId);

    const result = {
      run_id: String(run.id),
      status: run.status,
      conclusion: run.conclusion || null,
      run_number: run.run_number,
    };

    // Get job steps for progress info (fetched once, reused for error detail)
    let cachedJobsData = null;
    try {
      cachedJobsData = await getRunJobs(env, runId);
      if (cachedJobsData.jobs && cachedJobsData.jobs.length > 0) {
        const job = cachedJobsData.jobs[0];
        const steps = job.steps || [];
        const completedSteps = steps.filter(
          (s) => s.status === 'completed'
        ).length;
        const currentStep = steps.find((s) => s.status === 'in_progress');

        result.current_step = completedSteps + (currentStep ? 1 : 0);
        result.total_steps = steps.length;
        result.step_name = currentStep
          ? currentStep.name
          : steps.length > 0
          ? steps[steps.length - 1].name
          : null;

        // Include step details
        result.steps = steps.map((s, i) => ({
          name: s.name,
          status: s.status,
          conclusion: s.conclusion || null,
          number: i + 1,
        }));
      }
    } catch (e) {
      // Steps info is optional, don't fail
      console.error('Failed to get job steps:', e.message);
    }

    // Include error info if failed — reuse already-fetched jobsData
    if (run.conclusion === 'failure') {
      result.error = 'Build failed';
      try {
        const jobsData = cachedJobsData || (await getRunJobs(env, runId));
        if (jobsData.jobs && jobsData.jobs.length > 0) {
          const steps = jobsData.jobs[0].steps || [];
          const failedStep = steps.find((s) => s.conclusion === 'failure');
          if (failedStep) {
            result.error = `Failed at step: ${failedStep.name}`;
          }
          // Also surface any step-level error annotation
          const failedStepNumber = failedStep
            ? steps.indexOf(failedStep) + 1
            : null;
          if (failedStepNumber !== null) {
            result.failed_step_number = failedStepNumber;
          }
        }
      } catch (e) {
        // Use default error message
      }
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(`Failed to get status: ${error.message}`, 500);
  }
}

async function handleJobLive(request, env) {
  const resolved = await resolveRun(request, env);

  if (!resolved) {
    return errorResponse('Missing run_id or job_id parameter');
  }

  if (!resolved.runId) {
    return jsonResponse({
      run_id: null,
      status: 'queued',
      conclusion: null,
      run_number: null,
      current_step: null,
      total_steps: null,
      step_name: 'Waiting for workflow run',
      steps: [],
      error: null,
    });
  }

  try {
    const runId = resolved.runId;
    const [run, jobsData] = await Promise.all([
      getRunStatus(env, runId),
      getRunJobs(env, runId),
    ]);

    const result = {
      run_id: String(run.id),
      status: run.status,
      conclusion: run.conclusion || null,
      run_number: run.run_number,
      steps: [],
    };

    if (jobsData.jobs && jobsData.jobs.length > 0) {
      const job = jobsData.jobs[0];
      result.steps = (job.steps || []).map((s, i) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion || null,
        number: i + 1,
      }));

      const completedSteps = result.steps.filter(
        (s) => s.status === 'completed'
      ).length;
      const currentStep = result.steps.find((s) => s.status === 'in_progress');
      result.current_step = completedSteps + (currentStep ? 1 : 0);
      result.total_steps = result.steps.length;
      result.step_name = currentStep
        ? currentStep.name
        : result.steps.length > 0
        ? result.steps[result.steps.length - 1].name
        : null;
    }

    if (run.conclusion === 'failure') {
      result.error = 'Build failed';
      const failedStep = result.steps.find((s) => s.conclusion === 'failure');
      if (failedStep) {
        result.error = `Failed at step: ${failedStep.name}`;
        result.failed_step_number = failedStep.number;
      }
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(`Failed to get live status: ${error.message}`, 500);
  }
}

export { handleStatus, handleJobLive };
