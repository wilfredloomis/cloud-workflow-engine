import { handleOptions, withCors } from './utils/cors.js';
import { errorResponse } from './utils/json.js';
import { handleError } from './utils/errors.js';
import { handlePrepareUpload } from './routes/prepareUpload.js';
import { handleUpload } from './routes/upload.js';
import { handleDispatchJob } from './routes/dispatchJob.js';
import { handleStatus, handleJobLive } from './routes/status.js';
import { handleLogs } from './routes/logs.js';
import { handleArtifactInfo, handleArtifactDownload } from './routes/artifact.js';
import { handleDeleteArtifact } from './routes/deleteArtifact.js';

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      let response;

      switch (path) {
        case '/prepare-upload':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handlePrepareUpload(request, env);
          break;

        case '/upload':
          if (method !== 'POST') return errorResponse('Method not allowed', 405);
          response = await handleUpload(request, env);
          break;

        case '/dispatch-job':
          if (method !== 'GET' && method !== 'POST')
            return errorResponse('Method not allowed', 405);
          response = await handleDispatchJob(request, env);
          break;

        case '/status':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handleStatus(request, env);
          break;

        case '/job-live':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handleJobLive(request, env);
          break;

        case '/logs':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handleLogs(request, env);
          break;

        case '/artifact-info':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handleArtifactInfo(request, env);
          break;

        case '/artifact':
          if (method !== 'GET') return errorResponse('Method not allowed', 405);
          response = await handleArtifactDownload(request, env);
          break;

        case '/delete-artifact':
          if (method !== 'DELETE') return errorResponse('Method not allowed', 405);
          response = await handleDeleteArtifact(request, env);
          break;

        case '/':
        case '/health':
          response = new Response(
            JSON.stringify({
              ok: true,
              service: 'Cloud Build Engine Worker',
              version: '1.0.0',
              endpoints: [
                'GET  /prepare-upload',
                'POST /upload',
                'GET|POST /dispatch-job',
                'GET  /status',
                'GET  /job-live',
                'GET  /logs',
                'GET  /artifact-info',
                'GET  /artifact',
                'DELETE /delete-artifact',
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
          break;

        default:
          response = errorResponse(`Not found: ${path}`, 404);
      }

      return withCors(response);
    } catch (error) {
      return withCors(handleError(error));
    }
  },
};
