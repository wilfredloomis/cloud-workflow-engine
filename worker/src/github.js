const GITHUB_API = 'https://api.github.com';

async function githubFetch(path, env, options = {}) {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const headers = {
    Authorization: `token ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'cloud-build-worker',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

async function githubJson(path, env, options = {}) {
  const response = await githubFetch(path, env, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text}`);
  }
  return response.json();
}

async function triggerWorkflow(env, inputs) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const workflowId = env.GITHUB_WORKFLOW_ID || 'build-apk.yml';

  const response = await githubFetch(
    `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    env,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: 'main',
        inputs,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger workflow: ${text}`);
  }

  return true;
}

async function getLatestRun(env, jobId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const data = await githubJson(
    `/repos/${owner}/${repo}/actions/runs?per_page=10&event=workflow_dispatch`,
    env
  );

  for (const run of data.workflow_runs) {
    if (run.name === 'Cloud APK Build') {
      return run;
    }
  }

  return null;
}

async function getRunStatus(env, runId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(`/repos/${owner}/${repo}/actions/runs/${runId}`, env);
}

async function getRunJobs(env, runId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, env);
}

async function getRunArtifacts(env, runId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(
    `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
    env
  );
}

async function downloadArtifact(env, artifactId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const response = await githubFetch(
    `/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
    env
  );

  if (!response.ok) {
    throw new Error(`Failed to download artifact: ${response.status}`);
  }

  return response;
}

async function deleteArtifact(env, artifactId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const response = await githubFetch(
    `/repos/${owner}/${repo}/actions/artifacts/${artifactId}`,
    env,
    { method: 'DELETE' }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete artifact: ${response.status}`);
  }

  return true;
}

async function uploadReleaseAsset(env, fileName, fileData) {
  const releaseId = env.GITHUB_RELEASE_ID;
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;

  const response = await githubFetch(uploadUrl, env, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
    },
    body: fileData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload asset: ${text}`);
  }

  return response.json();
}

async function getReleaseAssetUrl(env, assetId) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const response = await githubFetch(
    `/repos/${owner}/${repo}/releases/assets/${assetId}`,
    env,
    {
      headers: {
        Accept: 'application/octet-stream',
      },
    }
  );

  return response.url;
}

export {
  githubFetch,
  githubJson,
  triggerWorkflow,
  getLatestRun,
  getRunStatus,
  getRunJobs,
  getRunArtifacts,
  downloadArtifact,
  deleteArtifact,
  uploadReleaseAsset,
  getReleaseAssetUrl,
};
