import { randomUUID } from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = String(req.get('x-request-id') || '').trim();
  const id = incoming && incoming.length <= 100 ? incoming : randomUUID();

  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader('x-request-id', id);

  next();
}
