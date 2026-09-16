export function sendSuccess(res, {
  statusCode = 200,
  message = 'OK',
  data = null,
  meta = undefined
} = {}) {
  const payload = {
    success: true,
    message,
    data
  };

  if (meta !== undefined) payload.meta = meta;
  if (res.locals.requestId) payload.requestId = res.locals.requestId;

  return res.status(statusCode).json(payload);
}

export function sendError(res, {
  statusCode = 500,
  message = 'Terjadi kesalahan pada server.',
  code = 'INTERNAL_ERROR',
  details = undefined
} = {}) {
  const payload = {
    success: false,
    message,
    code
  };

  if (details !== undefined && details !== null) payload.details = details;
  if (res.locals.requestId) payload.requestId = res.locals.requestId;

  return res.status(statusCode).json(payload);
}
