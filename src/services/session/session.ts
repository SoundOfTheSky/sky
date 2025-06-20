import { randomUUID } from 'node:crypto'

import { SignJWT, jwtVerify } from 'jose'

import { HTTPResponse } from '@/services/routing/types'
import { setCookie } from '@/services/routing/utilities'
import { SessionPayload } from '@/sky-shared/session'

// === TOKENS ===

export type SignedToken = {
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
  body: SessionPayload,
  options: { expiresIn?: number; subject?: string } = {},
): Promise<SignedToken> {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: await new SignJWT({ ...body, version: JWT_VERSION })
      .setProtectedHeader({ alg: JWT_ALG })
      .setIssuedAt(now)
      .setExpirationTime(now + (options.expiresIn ?? JWT_EXPIRES))
      .setSubject(options.subject ?? randomUUID())
      .sign(JWT_SECRET),
    token_type: 'Bearer',
    expires_in: options.expiresIn ?? JWT_EXPIRES,
  }
}
export async function verifyJWT<T = SessionPayload>(token?: string | null) {
  if (!token) return
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

/**
 * Clear disposed tokens, challenges
 */
setInterval(() => {
  const now = Date.now()
  for (const [sub, time] of disposedTokens.entries())
    if (now - time > JWT_EXPIRES * 1000) disposedTokens.delete(sub)
}, JWT_REFRESH * 1000)

// === Visits ===
// export const visitsStats = {
//   visits: (storeTable.getValue('visits') ?? 0) as number,
//   uniqueVisits: (storeTable.getValue('uniqueVisits') ?? 0) as number,
// }
// function registerVisit(unique: boolean) {
//   const key = unique ? 'uniqueVisits' : 'visits'
//   visitsStats[key]++
//   storeTable.setValue(key, visitsStats[key])
//   if (unique) registerVisit(false)
//   else visitEmitter.emit('update')
// }
// // eslint-disable-next-line unicorn/prefer-event-target
// export const visitEmitter = new EventEmitter()
