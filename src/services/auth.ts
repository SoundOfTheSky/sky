/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { default as JWT } from 'jsonwebtoken';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  RegistrationResponseJSON,
} from '@simplewebauthn/typescript-types';

import { getCookies, log, MakeOptional, setCookie, ValidationError } from '../utils';
import {
  convertFromArray,
  convertFromBoolean,
  convertToArray,
  convertToBoolean,
  DB,
  DBTable,
  TableDefaults,
} from '../db';

const JWT_VERSION = process.env['JWT_VERSION'] ?? 1;
const EXPIRES_IN = 60 * 60 * 24 * 7; // Week
const AUTH_REFRESH_AFTER = 60 * 60 * 24; // 1 hour in seconds
const RP_NAME = 'SoundOfTheSky';
const RP_ID = process.env['HTTP_ORIGIN']!.slice(8);
const RP_ORIGIN = process.env['HTTP_ORIGIN']!;
const CHALLENGE_TIMEOUT = 900_000; // 15 min
const sessionData = new Map<string, SessionData>();
const disposedTokens = new Map<string, number>(); // Token/time of disposal

export type SessionData = {
  timeout: NodeJS.Timeout;
  expires: number;
  challenge?: {
    challenge: string;
    timeout: NodeJS.Timeout;
    expires: number;
  };
};
export enum PERMISSIONS {
  HOUSE = 'house',
  DISK = 'disk',
  STUDY = 'study',
  ADMIN = 'admin',
}
export type User = TableDefaults & {
  username: string;
  status: number;
  permissions: PERMISSIONS[];
  avatar?: string;
};

// === DB tables ===
export class UsersTable extends DBTable<User> {
  constructor(table: string) {
    super(table, {
      username: {
        type: 'TEXT',
        required: true,
      },
      status: {
        type: 'INTEGER',
        default: 0,
      },
      permissions: {
        type: 'TEXT',
        required: true,
        from: convertFromArray,
        to: convertToArray,
      },
      avatar: {
        type: 'TEXT',
      },
    });
  }
  checkIfUsernameExists(username: string) {
    return DB.prepare(`SELECT COUNT(1) FROM ${this.name} WHERE username = ?`).get(username)!['COUNT(1)'] !== 0;
  }
  getByUsername(username: string) {
    return this.convertFrom(DB.prepare(`SELECT * FROM ${this.name} WHERE username = ?`).get(username));
  }
}
export const usersTable = new UsersTable('users');
type Authenticator = TableDefaults & {
  credentialID: Buffer;
  credentialPublicKey: Buffer;
  counter: number;
  credentialDeviceType: CredentialDeviceType;
  credentialBackedUp: boolean;
  userId: number;
  transports?: AuthenticatorTransportFuture[];
};
class AuthenticatorsTable extends DBTable<Authenticator> {
  constructor(table: string) {
    super(table, {
      credentialID: {
        type: 'TEXT',
        required: true,
        primaryKey: true,
        rename: 'id',
        to: (from: Buffer | undefined | null) => (from ? from.toString('base64url') : from),
        from: (from) => (typeof from === 'string' ? Buffer.from(from, 'base64url') : from),
      },
      credentialPublicKey: {
        type: 'BLOB',
        required: true,
      },
      counter: {
        type: 'INTEGER',
        required: true,
      },
      credentialDeviceType: {
        type: 'TEXT',
        required: true,
      },
      credentialBackedUp: {
        type: 'INTEGER',
        required: true,
        to: convertToBoolean,
        from: convertFromBoolean,
      },
      transports: {
        type: 'TEXT',
        to: convertToArray,
        from: convertFromArray,
      },
      userId: {
        type: 'INTEGER',
        required: true,
        ref: {
          column: 'id',
          table: 'users',
          onDelete: 'CASCADE',
        },
      },
    });
  }
  getAllByUser(userId: number): Authenticator[] {
    return DB.prepare(`SELECT * FROM ${this.name} WHERE user_id = ?`)
      .all(userId)
      .map(this.convertFrom.bind(this)) as Authenticator[];
  }
}
export const authenticatorsTable = new AuthenticatorsTable('authenticators');

// === WebAuthn ===
export const addChallenge = (session: SessionData, challenge: string) => {
  session.challenge = {
    challenge,
    timeout: setTimeout(() => removeChallenge(session), CHALLENGE_TIMEOUT),
    expires: Date.now() + CHALLENGE_TIMEOUT,
  };
};
export function removeChallenge(session: SessionData) {
  if (!session.challenge) return;
  clearTimeout(session.challenge.timeout);
  delete session.challenge;
}
export function getLoginOptions(userAuthenticators: Authenticator[]) {
  return generateAuthenticationOptions({
    allowCredentials: userAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      type: 'public-key',
      transports: authenticator.transports,
    })),
    userVerification: 'preferred',
    timeout: CHALLENGE_TIMEOUT,
    rpID: RP_ID,
  });
}
export async function verifyLogin(
  authenticator: Authenticator,
  expectedChallenge: string,
  response: AuthenticationResponseJSON,
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    authenticator,
    requireUserVerification: false,
  });
}
export function getRegistrationOptions(username: string) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: username,
    userName: username,
    attestationType: 'none',
    timeout: CHALLENGE_TIMEOUT,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    userDisplayName: username,
  });
}
export function verifyRegistration(expectedChallenge: string, response: RegistrationResponseJSON) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });
}

// === TOKENS ===
type JWTBody = {
  id: number;
  status: number;
  permissions: PERMISSIONS[];
  version: number;
};
type JWTPayload = JWTBody & {
  sub: string;
  iat: number;
  exp: number;
};
type SignedToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
};
export function sign(
  body: MakeOptional<JWTBody, 'version'>,
  options: Omit<JWT.SignOptions, 'expiresIn'> & { expiresIn?: number } = {},
): SignedToken {
  delete (body as any).iat;
  delete (body as any).exp;
  delete (body as any).sub;
  return {
    access_token: JWT.sign({ version: JWT_VERSION, ...body }, process.env['JWT_SECRET']!, {
      ...options,
      expiresIn: options.expiresIn ?? EXPIRES_IN,
      subject: options.subject ?? randomUUID(),
    }),
    token_type: 'Bearer',
    expires_in: options.expiresIn ?? EXPIRES_IN,
  };
}
export function verify(token: string) {
  try {
    const payload = JWT.verify(token.replace('Bearer ', ''), process.env['JWT_SECRET']!) as JWTPayload;
    if (payload.version !== JWT_VERSION) return;
    return payload;
  } catch {
    return;
  }
}
export function setAuth(res: ServerResponse, token: SignedToken) {
  setCookie(res, 'auth', `${token.token_type} ${token.access_token}; Max-Age=${token.expires_in}`);
}
export function deauth(res: ServerResponse) {
  setCookie(res, 'auth', 'deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
}
export function getSession(req: IncomingMessage, res: ServerResponse): [string, SessionData] {
  let sessionId = getCookies(req)['session']!;
  let session = sessionData.get(sessionId);
  if (session) return [sessionId, session];
  sessionId = randomUUID();
  session = {
    expires: Date.now() + EXPIRES_IN,
    timeout: setTimeout(() => removeToken(sessionId), EXPIRES_IN),
  };
  sessionData.set(sessionId, session);
  setCookie(res, 'session', `${sessionId}; Max-Age=${EXPIRES_IN}`);
  return [sessionId, session];
}
export function removeToken(id: string) {
  sessionData.delete(id);
}
export function authCheck(
  req: IncomingMessage,
  res: ServerResponse,
  neededPermissions: PERMISSIONS[] = [],
  dontThrow401?: boolean,
) {
  if (process.env['DISABLE_AUTH'] === 'true')
    return {
      exp: Date.now() + 3_600_000,
      iat: Date.now(),
      id: 1,
      permissions: [PERMISSIONS.ADMIN],
      status: 1,
      sub: '0',
      version: +JWT_VERSION,
    };
  const token = getCookies(req)['auth'] ?? req.headers.authorization;
  if (!token) {
    if (!dontThrow401) res.writeHead(401).end();
    return;
  }
  const payload = verify(token);
  if (!payload || disposedTokens.has(payload.sub)) {
    deauth(res);
    if (!dontThrow401) res.writeHead(401).end();
    return;
  }
  const permission =
    payload.permissions.includes(PERMISSIONS.ADMIN) ||
    neededPermissions.every((perm) => payload.permissions.some((uPerm) => perm.startsWith(uPerm)));
  if (!req.headers.authorization && permission && payload.iat + AUTH_REFRESH_AFTER < Date.now() / 1000) {
    disposedTokens.set(payload.sub, Date.now());
    setAuth(
      res,
      sign(payload, {
        expiresIn: payload.exp - payload.iat,
      }),
    );
  }
  if (!permission && !dontThrow401) res.writeHead(401).end();
  return permission ? payload : undefined;
}

/**
 * Clear disposed tokens
 */
setInterval(() => {
  const now = Date.now();
  for (const [sub, time] of disposedTokens.entries()) if (now - time > EXPIRES_IN * 1000) disposedTokens.delete(sub);
}, EXPIRES_IN);

log(
  `Admin token: ${
    sign(
      {
        id: 1,
        permissions: [PERMISSIONS.ADMIN],
        status: 1,
      },
      {
        expiresIn: 60 * 60 * 24 * 365,
      },
    ).access_token
  }`,
);
