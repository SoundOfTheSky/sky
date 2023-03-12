import type { IncomingMessage, ServerResponse } from 'node:http';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';
import { HTTPError, log, ValidationError } from '../utils';

const handlers: ApiHandler[] = [];

export type ApiHandler = (req: IncomingMessage, res: ServerResponse, query: URL) => Promise<void>;

async function loadHandlersInDirectory(directory: string) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const stats = await stat(path);
    if (stats.isDirectory()) await loadHandlersInDirectory(path);
    else if (
      (path.endsWith('.ts') || path.endsWith('.js')) &&
      !path.includes('api/index.') &&
      !path.includes('api/static.')
    )
      handlers.push(((await import(path)) as { default: ApiHandler }).default);
  }
}
await loadHandlersInDirectory(fileURLToPath(new URL('.', import.meta.url)));
handlers.push(((await import(fileURLToPath(new URL('static', import.meta.url)))) as { default: ApiHandler }).default);

// eslint-disable-next-line sonarjs/cognitive-complexity
export default (async function (req, res, query) {
  for (const handler of handlers) {
    try {
      await handler(req, res, query);
      if (res.headersSent || !res.writable) return;
    } catch (error) {
      const isValidationError = error instanceof ValidationError;
      const isHTTPError = error instanceof HTTPError;
      if (!isValidationError && !isHTTPError) log(error);
      if (!res.headersSent && res.writable)
        if (isHTTPError) res.writeHead(error.code).end(error.body);
        else res.writeHead(isValidationError ? 400 : 500).end((error as Error).message);
    }
  }
  if (!res.headersSent && res.writable) res.writeHead(404).end();
  return true;
} as ApiHandler);
