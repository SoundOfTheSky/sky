import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { SignJWT, jwtVerify } from 'jose';
import { storeTable } from '@/services/store';
import { MakeOptional } from '@/utils';
import { HTTPError, HTTPResponse, getCookies, setCookie } from '@/services/http';
import { PERMISSIONS } from '@/services/session/user';

// === Visits ===
export const visitsStats = {
  visits: (storeTable.getValue('visits') ?? 0) as number,
  uniqueVisits: (storeTable.getValue('uniqueVisits') ?? 0) as number,
};
function registerVisit(unique: boolean) {
  const key = unique ? 'uniqueVisits' : 'visits';
  visitsStats[key]++;
  storeTable.setValue(key, visitsStats[key]);
  if (unique) registerVisit(false);
  else visitEmitter.emit('update');
}
export const visitEmitter = new EventEmitter();

// === TOKENS ===
type JWTBody = {
  user?: {
    id: number;
    status: number;
    permissions: PERMISSIONS[];
  };
  version: number;
};
export type JWTPayload = JWTBody & {
  sub: string; // JWT ID
  iat: number; // Issued at
  exp: number; // Exprires at
};
type SignedToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

const JWT_VERSION = 1;
const JWT_EXPIRES_IN_SEC = 60 * 60 * 50;
const JWT_EXPIRES_IN_MS = JWT_EXPIRES_IN_SEC * 1000;
const JWT_REFRESH_TIME = JWT_EXPIRES_IN_SEC - 60 * 60 * 10;
const JWT_SECRET = new TextEncoder().encode(process.env['JWT_SECRET']);
const JWT_ALG = 'HS256';
const disposedTokens = new Map<string, number>(); // Token/time of disposal

export async function signJWT(
  body: MakeOptional<JWTBody, 'version'>,
  options: { expiresIn?: number; subject?: string } = {},
): Promise<SignedToken> {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: await new SignJWT({ version: JWT_VERSION, ...body })
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt(now)
      .setExpirationTime(now + (options.expiresIn ?? JWT_EXPIRES_IN_SEC))
      .setSubject(options.subject ?? randomUUID())
      .sign(JWT_SECRET),
    token_type: 'Bearer',
    expires_in: options.expiresIn ?? JWT_EXPIRES_IN_SEC,
  };
}
export async function verify(token: string) {
  if (token.startsWith('Bearer ')) throw new Error('a');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALG],
    });
    if (payload.version !== JWT_VERSION) return;
    return payload as JWTPayload;
  } catch {
    return;
  }
}
export function setAuth(res: HTTPResponse, token: SignedToken) {
  setCookie(res, 'session', `${token.token_type} ${token.access_token}; Max-Age=${token.expires_in}`);
}

export async function sessionGuard(options: { req: Request }): Promise<JWTPayload | undefined>;
export async function sessionGuard(options: { req: Request; res: HTTPResponse }): Promise<JWTPayload>;
export async function sessionGuard(options: {
  req: Request;
  res?: HTTPResponse;
  permissions: PERMISSIONS[];
  throw401?: false;
}): Promise<(Omit<JWTPayload, 'user'> & { user: NonNullable<JWTPayload['user']> }) | undefined>;
export async function sessionGuard(options: {
  req: Request;
  res?: HTTPResponse;
  permissions: PERMISSIONS[];
  throw401: true;
}): Promise<Omit<JWTPayload, 'user'> & { user: NonNullable<JWTPayload['user']> }>;
export async function sessionGuard(options: {
  req: Request;
  res?: HTTPResponse;
  permissions?: PERMISSIONS[];
  throw401?: boolean;
}): Promise<JWTPayload | undefined> {
  const token = getCookies(options.req)['session'] ?? options.req.headers.get('authorization');
  const payload = token ? await verify(token.slice(7)) : undefined;
  if (!payload) {
    if (options.res) {
      registerVisit(true);
      const newSession = await signJWT({});
      setAuth(options.res, newSession);
      if (options.permissions && options.throw401) throw new HTTPError('Not allowed', 401);
      return verify(newSession.access_token)!;
    }
    return;
  }

  // Refresh token
  if (
    options.res &&
    !options.req.headers.has('authorization') &&
    (payload.exp - JWT_REFRESH_TIME) * 1000 < Date.now() &&
    !disposedTokens.has(payload.sub)
  ) {
    registerVisit(false);
    disposedTokens.set(payload.sub, Date.now());
    setAuth(options.res, await signJWT(payload));
  }

  // Check auth and permissions
  if (
    options.permissions &&
    (!payload.user ||
      (!payload.user.permissions.includes(PERMISSIONS.ADMIN) &&
        options.permissions.some((perm) => payload.user!.permissions.every((uPerm) => !perm.startsWith(uPerm)))))
  ) {
    if (options.throw401) throw new HTTPError('Not allowed', 401);
    return;
  }
  return payload;
}

/**
 * Clear disposed tokens, challenges
 */
setInterval(() => {
  const now = Date.now();
  for (const [sub, time] of disposedTokens.entries()) if (now - time > JWT_EXPIRES_IN_SEC) disposedTokens.delete(sub);
}, JWT_EXPIRES_IN_MS);