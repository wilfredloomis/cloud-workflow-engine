import { errorResponse } from './json.js';

function handleError(error) {
  console.error('Worker error:', error.message || error);

  if (error.status) {
    return errorResponse(error.message, error.status);
  }

  return errorResponse('Internal server error', 500);
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export { handleError, AppError };
