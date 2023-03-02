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

import { getCookies, MakeOptional, parseTime, setCookie, ValidationError } from '../utils';
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
const EXPIRES_IN = 60 * 60 * 4; // 4 hours
const AUTH_REFRESH_AFTER = 60 * 60; // 1 hour in seconds

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

// DB.prepare('INSERT INTO users (username, permissions) VALUES (?, ?)').run('SoundOfTheSky', 'admin');
// DB.prepare('DELETE FROM users WHERE id != 1').run();
// DB.prepare('DROP TABLE IF EXISTS authenticators').run();
// DB.prepare('UPDATE authenticators SET user_id=1 WHERE user_id=50').run();

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
const RP_NAME = 'SoundOfTheSky';
const RP_ID = process.env['HTTP_ORIGIN']!.slice(8);
const RP_ORIGIN = process.env['HTTP_ORIGIN']!;
const CHALLENGE_TIMEOUT = 300_000;
const challenges = new Map<string, [NodeJS.Timeout, string, number]>();

/**
 * Add challenge that will timeout.
 * @param username unique user name
 * @param challenge WebAuthn challenge
 */
const addChallenge = (username: string, challenge: string) => {
  const timeout = setTimeout(() => challenges.delete(username), CHALLENGE_TIMEOUT);
  challenges.set(username, [timeout, challenge, Date.now() + CHALLENGE_TIMEOUT]);
};

/**
 * Start login process and get WebAuthn options.
 * @param username unique user name
 * @returns WebAuthn challenge
 */
export function startLogin(username: string) {
  if (challenges.has(username))
    throw new ValidationError(
      `Someone already trying to log in under this user wait ${parseTime(challenges.get(username)![2] - Date.now())}`,
    );
  const user = usersTable.getByUsername(username);
  if (!user) throw new ValidationError('User not found');
  const userAuthenticators = authenticatorsTable.getAllByUser(user.id);
  const options = generateAuthenticationOptions({
    allowCredentials: userAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      type: 'public-key',
      transports: authenticator.transports,
    })),
    userVerification: 'preferred',
    timeout: CHALLENGE_TIMEOUT,
    rpID: RP_ID,
  });
  addChallenge(username, options.challenge);
  return options;
}

/**
 * Verify user's authenticator response and finish login.
 * @param username unique user name
 * @param response user's authenticator response
 * @returns JWT object or throws an error
 */
export async function verifyLogin(username: string, response: AuthenticationResponseJSON) {
  const user = usersTable.getByUsername(username);
  if (!user) throw new ValidationError('User not found');
  const expectedChallenge = challenges.get(username);
  if (!expectedChallenge) throw new ValidationError('Challenge timeout');
  challenges.delete(username);
  clearTimeout(expectedChallenge[0]);
  const authenticator = authenticatorsTable.get(response.id);
  if (!authenticator) throw new ValidationError('Authenticator not found');
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: expectedChallenge[1],
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    authenticator,
    requireUserVerification: false,
  });
  if (!verification.verified) throw new ValidationError('Not verified');
  return sign({
    id: user.id,
    permissions: user.permissions,
    status: user.status,
  });
}

/**
 * Start registration process and get WebAuthn options.
 * @param username unique name for new user
 * @returns WebAuthn options
 */
export function startRegistration(username: string) {
  if (usersTable.checkIfUsernameExists(username) || challenges.has(username))
    throw new ValidationError('Username exists');
  const options = generateRegistrationOptions({
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
  addChallenge(username, options.challenge);
  return options;
}

/**
 * Verify user's authenticator response and finish registration.
 * @param username unique name for new user
 * @param response user's authenticator response
 * @returns JWT object or throws an error
 */
export async function verifyRegistration(username: string, response: RegistrationResponseJSON) {
  if (usersTable.checkIfUsernameExists(username)) throw new ValidationError('Username exists');
  const expectedChallenge = challenges.get(username);
  if (!expectedChallenge) throw new ValidationError('Challenge timeout');
  challenges.delete(username);
  clearTimeout(expectedChallenge[0]);
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: expectedChallenge[1],
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) throw new ValidationError('Not verified');
  const id = usersTable.create({
    username,
    status: 0,
    permissions: [],
  }).lastInsertRowid as number;
  authenticatorsTable.create({
    counter: verification.registrationInfo.counter,
    credentialBackedUp: verification.registrationInfo.credentialBackedUp,
    credentialDeviceType: verification.registrationInfo.credentialDeviceType,
    credentialID: Buffer.from(verification.registrationInfo.credentialID),
    credentialPublicKey: Buffer.from(verification.registrationInfo.credentialPublicKey),
    transports: response.response.transports,
    userId: id,
  });
  return sign({
    id,
    permissions: [],
    status: 0,
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

const disposedTokens = new Map<string, number>();

type SignedToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
};
/**
 * Sign new token.
 * @param body body of JWT
 * @param options JWT options
 * @returns JWT object
 */
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

/**
 * Verify token
 * @param token JWT token
 * @returns JWT payload or false
 */
export function verify(token: string) {
  try {
    const payload = JWT.verify(token.replace('Bearer ', ''), process.env['JWT_SECRET']!) as JWTPayload;
    if (payload.version !== JWT_VERSION) return false;
    return payload;
  } catch {
    return false;
  }
}

/**
 *
 * @param res HTTP response
 * @param token Signed token
 */
export function setAuth(res: ServerResponse, token: SignedToken) {
  setCookie(res, 'Authorization', `${token.token_type} ${token.access_token}; Max-Age=${token.expires_in}`);
}

/**
 * Deauth user and redirect to auth
 * @param res HTTP response
 */
export function deauth(res: ServerResponse) {
  setCookie(res, 'Authorization', 'deleted; expires=Thu, 01 Jan 1970 00:00:00 GMT');
  //sendRedirect(res, '/auth');
}

/**
 * Check if user has valid authorization and permissions.
 * If not it will redirect user to auth.
 * Also updates token if it's about to expire.
 * @param req HTTP request
 * @param res HTTP response
 * @param neededPermissions array of permissions to check
 * @returns true if everything is ok
 */
export function authCheck(
  req: IncomingMessage,
  res: ServerResponse,
  neededPermissions: PERMISSIONS[] = [],
): false | JWTPayload {
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
  const token = getCookies(req)['Authorization'] ?? req.headers.authorization;
  if (!token) return false;
  const payload = verify(token);
  if (!payload) {
    deauth(res);
    return false;
  }
  const permission =
    payload.permissions.includes(PERMISSIONS.ADMIN) ||
    neededPermissions.every((perm) => payload.permissions.some((uPerm) => perm.startsWith(uPerm)));
  if (
    !req.headers.authorization &&
    permission &&
    payload.iat + AUTH_REFRESH_AFTER < Date.now() / 1000 &&
    !disposedTokens.has(payload.sub)
  ) {
    disposedTokens.set(payload.sub, Date.now());
    const newToken = sign(payload, {
      expiresIn: payload.exp - payload.iat,
    });
    setAuth(res, newToken);
  }
  return permission ? payload : false;
}

/**
 * Clear updated tokens
 */
setInterval(() => {
  const now = Date.now();
  for (const [sub, time] of disposedTokens.entries()) if (now - time > EXPIRES_IN * 1000) disposedTokens.delete(sub);
}, EXPIRES_IN);
