import { jsonResponse, errorResponse } from '../utils/json.js';
import { getLatestRun, getRunJobs, getJobLogs } from '../github.js';

async function resolveRunAndJob(request, env) {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const buildJobId = url.searchParams.get('job_id');

  if (runId) {
    try {
      const jobsData = await getRunJobs(env, runId);
      const selectedJob =
        jobsData.jobs?.find((job) => job.conclusion === 'failure') ||
        jobsData.jobs?.[0] ||
        null;
      return {
        runId,
        buildJobId,
        workflowJobId: selectedJob ? String(selectedJob.id) : null,
        workflowJobName: selectedJob?.name || null,
      };
    } catch (error) {
      if (!buildJobId) {
        throw error;
      }
    }
  }

  if (!buildJobId) {
    return null;
  }

  const run = await getLatestRun(env, buildJobId);
  if (!run) {
    return {
      runId: null,
      buildJobId,
      workflowJobId: null,
      workflowJobName: null,
    };
  }

  const jobsData = await getRunJobs(env, run.id);
  const selectedJob =
    jobsData.jobs?.find((job) => job.conclusion === 'failure') ||
    jobsData.jobs?.[0] ||
    null;

  return {
    runId: String(run.id),
    buildJobId,
    workflowJobId: selectedJob ? String(selectedJob.id) : null,
    workflowJobName: selectedJob?.name || null,
  };
}

async function handleLogs(request, env) {
  try {
    const resolved = await resolveRunAndJob(request, env);

    if (!resolved) {
      return errorResponse('Missing run_id or job_id parameter');
    }

    if (!resolved.runId) {
      return jsonResponse({
        run_id: null,
        workflow_job_id: null,
        workflow_job_name: null,
        log: '',
        ready: false,
      });
    }

    if (!resolved.workflowJobId) {
      return jsonResponse({
        run_id: resolved.runId,
        workflow_job_id: null,
        workflow_job_name: null,
        log: '',
        ready: false,
      });
    }

    const log = await getJobLogs(env, resolved.workflowJobId);

    return jsonResponse({
      run_id: resolved.runId,
      workflow_job_id: resolved.workflowJobId,
      workflow_job_name: resolved.workflowJobName,
      log,
      ready: true,
    });
  } catch (error) {
    return errorResponse(`Failed to fetch logs: ${error.message}`, 500);
  }
}

export { handleLogs };
