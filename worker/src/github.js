const GITHUB_API = 'https://api.github.com';

function requireGithubConfig(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Worker secrets: ${missing.join(', ')}`);
  }
}

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
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
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
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const data = await githubJson(
    `/repos/${owner}/${repo}/actions/runs?per_page=30&event=workflow_dispatch`,
    env
  );

  return (
    data.workflow_runs.find(
      (run) =>
        run.display_title?.includes(jobId) ||
        run.name?.includes(jobId)
    ) || null
  );
}

async function getRunStatus(env, runId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(`/repos/${owner}/${repo}/actions/runs/${runId}`, env);
}

async function getRunJobs(env, runId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, env);
}

async function getJobLogs(env, jobId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const response = await githubFetch(
    `/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
    env,
    {
      redirect: 'manual',
      headers: {
        Accept: 'application/vnd.github.v3.raw',
      },
    }
  );

   if (response.status === 302 || response.status === 301) {
    const redirectUrl = response.headers.get('Location');
    if (!redirectUrl) {
      throw new Error('Job logs redirect is missing a Location header');
    }

    const redirectedResponse = await fetch(redirectUrl);
    if (!redirectedResponse.ok) {
      const text = await redirectedResponse.text();
      throw new Error(`Failed redirected job logs fetch: ${redirectedResponse.status} ${text}`);
    }

    return redirectedResponse.text();
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch job logs: ${response.status} ${text}`);
  }

  return response.text();
}

async function getRunArtifacts(env, runId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  return githubJson(
    `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`,
    env
  );
}

async function downloadArtifact(env, artifactId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;

  const response = await githubFetch(
    `/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`,
    env,
    {
      redirect: 'manual',
    }
  );

  if (response.status === 302 || response.status === 301) {
    const redirectUrl = response.headers.get('Location');
    if (!redirectUrl) {
      throw new Error('Artifact download redirect is missing a Location header');
    }

    const redirectedResponse = await fetch(redirectUrl);
    if (!redirectedResponse.ok) {
      throw new Error(`Failed redirected artifact download: ${redirectedResponse.status}`);
    }

    return redirectedResponse;
  }

  if (!response.ok) {
    throw new Error(`Failed to download artifact: ${response.status}`);
  }

  return response;
}

async function deleteArtifact(env, artifactId) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
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

async function resolveReleaseId(env) {
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
  if (env.GITHUB_RELEASE_ID) return env.GITHUB_RELEASE_ID;

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const tag = env.GITHUB_RELEASE_TAG || 'cloud-build-storage';

  const existingResponse = await githubFetch(
    `/repos/${owner}/${repo}/releases/tags/${tag}`,
    env
  );

  if (existingResponse.ok) {
    const release = await existingResponse.json();
    return release.id;
  }

  if (existingResponse.status !== 404) {
    const text = await existingResponse.text();
    throw new Error(`Failed to resolve storage release: ${text}`);
  }

  const createResponse = await githubFetch(`/repos/${owner}/${repo}/releases`, env, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      name: 'Cloud Build Storage',
      body: 'Temporary source ZIP storage for Cloud Build Engine uploads.',
      draft: false,
      prerelease: true,
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    throw new Error(`Failed to create storage release: ${text}`);
  }

  const release = await createResponse.json();
  return release.id;
}

async function uploadReleaseAsset(env, fileName, fileData) {
  const releaseId = await resolveReleaseId(env);
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
  requireGithubConfig(env, ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
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
  getJobLogs,
  getRunArtifacts,
  downloadArtifact,
  deleteArtifact,
  resolveReleaseId,
  uploadReleaseAsset,
  getReleaseAssetUrl,
};
