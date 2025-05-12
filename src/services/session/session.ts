import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'

import { SignJWT, jwtVerify } from 'jose'

import { HTTPResponse } from '@/services/http/types'
import { HTTPError, getCookies, setCookie } from '@/services/http/utilities'
import { storeTable } from '@/services/store'

// === TOKENS ===
type JWTBody = {
  user?: {
    id: number
    status: number
    permissions: string[]
  }
  version: number
}
export type JWTPayload = JWTBody & {
  sub: string // JWT ID
  iat: number // Issued at
  exp: number // Exprires at
}
type SignedToken = {
  access_token: string
  token_type: string
  expires_in: number
}

const JWT_VERSION = 1
const JWT_EXPIRES = 60 * 60 * 24 * 30
const JWT_REFRESH = 60 * 60 * 4
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const JWT_ALG = 'HS256'
const disposedTokens = new Map<string, number>() // Token/time of disposal

export async function signJWT(
  body: object,
  options: { expiresIn?: number; subject?: string } = {},
): Promise<SignedToken> {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: await new SignJWT({ version: JWT_VERSION, ...body })
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt(now)
      .setExpirationTime(now + (options.expiresIn ?? JWT_EXPIRES))
      .setSubject(options.subject ?? randomUUID())
      .sign(JWT_SECRET),
    token_type: 'Bearer',
    expires_in: options.expiresIn ?? JWT_EXPIRES,
  }
}
export async function verifyJWT<T = JWTPayload>(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALG],
    })
    if (payload.version !== JWT_VERSION) return
    return payload as T
  } catch {
    return
  }
}
export function setAuth(response: HTTPResponse, token: SignedToken) {
  setCookie(
    response,
    'session',
    `${token.token_type} ${token.access_token}; Max-Age=${token.expires_in}`,
  )
}

export async function sessionGuard(options: {
  request: Request
}): Promise<JWTPayload | undefined>
export async function sessionGuard(options: {
  request: Request
  response: HTTPResponse
}): Promise<JWTPayload>
export async function sessionGuard(options: {
  request: Request
  response?: HTTPResponse
  permissions: string[]
  throw401?: false
}): Promise<
  | (Omit<JWTPayload, 'user'> & { user: NonNullable<JWTPayload['user']> })
  | undefined
>
export async function sessionGuard(options: {
  request: Request
  response?: HTTPResponse
  permissions: string[]
  throw401: true
}): Promise<
  Omit<JWTPayload, 'user'> & { user: NonNullable<JWTPayload['user']> }
>
export async function sessionGuard(options: {
  request: Request
  response?: HTTPResponse
  permissions?: string[]
  throw401?: boolean
}): Promise<JWTPayload | undefined> {
  const token =
    getCookies(options.request).session ??
    options.request.headers.get('authorization')
  const payload = token ? await verifyJWT(token.slice(7)) : undefined
  // If no token
  if (!payload) {
    if (options.response) {
      registerVisit(true)
      const newSession = await signJWT({})
      setAuth(options.response, newSession)
      if (options.permissions && options.throw401)
        throw new HTTPError('Not allowed', 401)
      return verifyJWT(newSession.access_token)
    }
    return
  }

  // Refresh token
  const alreadyDisposed = disposedTokens.has(payload.sub)
  if (
    options.response &&
    (payload.iat + JWT_REFRESH) * 1000 < Date.now() &&
    !alreadyDisposed
  ) {
    registerVisit(false)
    disposedTokens.set(payload.sub, Date.now())
    setAuth(options.response, await signJWT(payload))
  }
  if (
    alreadyDisposed ||
    (options.permissions &&
      (!payload.user ||
        (!payload.user.permissions.includes('ADMIN') &&
          options.permissions.some(
            (perm) => !payload.user!.permissions.includes(perm),
          ))))
  ) {
    if (options.throw401) throw new HTTPError('Not allowed', 401)
    return
  }
  return payload
}

/**
 * Clear disposed tokens, challenges
 */
setInterval(() => {
  const now = Date.now()
  for (const [sub, time] of disposedTokens.entries())
    if (now - time > JWT_EXPIRES * 1000) disposedTokens.delete(sub)
}, JWT_REFRESH * 1000)

// === Visits ===
export const visitsStats = {
  visits: (storeTable.getValue('visits') ?? 0) as number,
  uniqueVisits: (storeTable.getValue('uniqueVisits') ?? 0) as number,
}
function registerVisit(unique: boolean) {
  const key = unique ? 'uniqueVisits' : 'visits'
  visitsStats[key]++
  storeTable.setValue(key, visitsStats[key])
  if (unique) registerVisit(false)
  else visitEmitter.emit('update')
}
// eslint-disable-next-line unicorn/prefer-event-target
export const visitEmitter = new EventEmitter()
