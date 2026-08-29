type RequestLike = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
} & AsyncIterable<Buffer | string>;

function parseJsonBody(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function prepareServerlessRequestBody(
  req: RequestLike,
): Promise<unknown> {
  if (!req || !req.method) {
    return req?.body;
  }

  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return req.body;
  }

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      const contentType = String(req.headers?.['content-type'] ?? '').toLowerCase();
      if (contentType.includes('application/json')) {
        return parseJsonBody(req.body);
      }
      return req.body;
    }

    if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
      const raw = Buffer.from(req.body).toString('utf8');
      const contentType = String(req.headers?.['content-type'] ?? '').toLowerCase();
      if (contentType.includes('application/json')) {
        return parseJsonBody(raw);
      }
      return raw;
    }

    return req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
    } else {
      chunks.push(Buffer.from(chunk));
    }
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody.trim()) {
    return undefined;
  }

  const contentType = String(req.headers?.['content-type'] ?? '').toLowerCase();
  if (contentType.includes('application/json')) {
    return parseJsonBody(rawBody);
  }

  return rawBody;
}