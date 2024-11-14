import { IncomingMessage } from 'node:http'
import { RequestOptions, request as httpsRequest } from 'node:https'
import { URL } from 'node:url'
// import { BrotliDecompress, Deflate, Gunzip, createGunzip, createBrotliDecompress, createDeflate } from 'node:zlib';

export type HTTPSRequestOptions = RequestOptions & {
  followRedirects?: boolean
  body?: unknown
  raw?: boolean
}

export const parseCookies = (cookies: string) =>
  Object.fromEntries(
    cookies
      .split(';')
      .map(x => x.split('=').map(x => x.trim()))
      .filter(x => x.length === 2) as [string, string][],
  )
export const stringifyCookies = (cookies: Record<string, string>) =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

export function decodeReponse(
  response: IncomingMessage,
  raw?: false,
): Promise<Buffer>
export function decodeReponse(response: IncomingMessage, raw: true): IncomingMessage
export function decodeReponse(
  response: IncomingMessage,
  raw?: boolean,
): Promise<Buffer> | IncomingMessage {
  if (raw) return response
  const data: Buffer[] = []
  return new Promise((resolve, reject) => {
    response.on('data', (c) => {
      data.push(c as Buffer)
    })
    response.on('error', reject)
    response.on('end', () => {
      resolve(Buffer.concat(data as unknown as Uint8Array[]))
    })
  })
}

export function HTTPSRequest(
  url: string,
  options: HTTPSRequestOptions = {},
): Promise<IncomingMessage> {
  const s = new URL(url)
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      {
        host: s.hostname,
        path: s.pathname + s.search,
        ...options,
      },
      resolve,
    )
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

export class HTTPSClient {
  public cookies: Record<string, string> = {}

  public constructor(
    public host: string,
    public defaultHeaders: HTTPSRequestOptions['headers'] = {},
  ) {
    defaultHeaders['user-agent']
      ??= 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36'
    defaultHeaders['accept-encoding'] ??= 'gzip, deflate, br'
    defaultHeaders['accept-language'] ??= 'en-US,en;q=0.9'
  }

  public async request(
    url: string,
    options?: HTTPSRequestOptions & { raw?: false },
  ): Promise<Buffer>
  public async request(
    url: string,
    options: HTTPSRequestOptions & { raw: true },
  ): Promise<IncomingMessage>
  public async request(
    url: string,
    options: HTTPSRequestOptions = {},
  ): Promise<Buffer | IncomingMessage> {
    options.followRedirects ??= true
    options.headers ??= {}
    options.headers = { ...this.defaultHeaders, ...options.headers }

    // === Setting Cookies ===
    options.headers.cookie = options.headers.cookie
      ? stringifyCookies({
        ...this.cookies,
        ...parseCookies(
          Array.isArray(options.headers.cookie)
            ? options.headers.cookie.join('; ')
            : options.headers.cookie.toString(),
        ),
      })
      : stringifyCookies(this.cookies)
    if (options.headers.cookie.length === 0) delete options.headers.cookie
    const response = await HTTPSRequest(
      url.startsWith('http') ? url : this.host + url,
      options,
    )

    // === Getting cookies ===
    for (const cookie of response.headers['set-cookie'] ?? []) {
      const [key, value] = cookie.split('=') as [string, string]
      this.cookies[key.trim()] = value.trim()
    }

    // === Follow redirects ===
    if (
      response.headers.location
      && response.statusCode
      && response.statusCode >= 300
      && response.statusCode < 400
    )
      return this.request(response.headers.location, options as never)

    // === Decode data ===
    return decodeReponse(response, options.raw as never)
  }
}
