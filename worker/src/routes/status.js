import { jsonResponse, errorResponse } from '../utils/json.js';
import { getRunStatus, getRunJobs } from '../github.js';

async function handleStatus(request, env) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');

  if (!runId) {
    return errorResponse('Missing run_id parameter');
  }

  try {
    const run = await getRunStatus(env, runId);

    const result = {
      status: run.status,
      conclusion: run.conclusion || null,
      run_number: run.run_number,
    };

    // Get job steps for progress info
    try {
      const jobsData = await getRunJobs(env, runId);
      if (jobsData.jobs && jobsData.jobs.length > 0) {
        const job = jobsData.jobs[0];
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

    // Include error info if failed
    if (run.conclusion === 'failure') {
      result.error = 'Build failed';
      try {
        const jobsData = await getRunJobs(env, runId);
        if (jobsData.jobs && jobsData.jobs.length > 0) {
          const failedStep = jobsData.jobs[0].steps?.find(
            (s) => s.conclusion === 'failure'
          );
          if (failedStep) {
            result.error = `Failed at step: ${failedStep.name}`;
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
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');

  if (!runId) {
    return errorResponse('Missing run_id parameter');
  }

  try {
    const [run, jobsData] = await Promise.all([
      getRunStatus(env, runId),
      getRunJobs(env, runId),
    ]);

    const result = {
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
    }

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(`Failed to get live status: ${error.message}`, 500);
  }
}

export { handleStatus, handleJobLive };
