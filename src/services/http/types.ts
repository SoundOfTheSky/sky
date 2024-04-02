import { MatchedRoute } from 'bun';

export type HTTPResponse = {
  headers: Headers;
  body?: BodyInit | null | undefined;
  /** @default 200 */
  status?: number;
  /** @default "OK" */
  statusText?: string;
};
export type HTTPHandler = (req: Request, res: HTTPResponse, route: MatchedRoute) => unknown;
