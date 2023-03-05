import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

export const colors = {
  '0_96_100': 'красный',
  '6_80_100': 'коралловый',
  '14_100_100': 'оранжевый',
  '25_96_100': 'желтый',
  '73_96_100': 'желтый', // салатовый
  '135_96_100': 'зеленый',
  '160_96_100': 'зеленый', // изумрудный
  '177_96_100': 'бирюзовый',
  '190_96_100': 'голубой',
  '225_96_100': 'синий',
  '231_10_100': 'сиреневый', // лунный
  '270_96_100': 'сиреневый',
  '280_96_100': 'фиолетовый',
  '306_96_100': 'фиолетовый', // пурпурный
  '325_96_100': 'розовый',
  '340_100_100': 'малиновый',
  '357_83_100': 'малиновый', // лиловый
} as Record<string, string>;

export function sendJSON(res: ServerResponse, body: unknown, options: { statusCode?: number; space?: number } = {}) {
  res
    .writeHead(options.statusCode ?? 200, {
      'Content-Type': 'application/json',
    })
    .end(JSON.stringify(body, undefined, options.space));
}

export function sendRedirect(res: ServerResponse, Location: string) {
  res.writeHead(302, { Location }).end();
}

export function setCookie(res: ServerResponse, name: string, value: string) {
  res.setHeader('Set-Cookie', `${name}=${value}; Path=/; SameSite=none; Secure; HttpOnly`);
}

export function getCookies(req: IncomingMessage) {
  if (!req.headers.cookie) return {};
  return Object.fromEntries(req.headers.cookie.split('; ').map((cookie) => cookie.split('='))) as Record<
    string,
    string
  >;
}

export function getDataFromRequest(req: IncomingMessage) {
  return new Promise<Buffer>((r) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', () => r(Buffer.concat(chunks)));
  });
}

let lastExecId = 0;
export async function execBuffer(bin: string, input: Buffer, args: string[]) {
  const fakeInputI = args.indexOf('INPUT_PATH');
  const fakeOutputI = args.indexOf('OUTPUT_PATH');
  let inputPath = '';
  let outputPath = '';
  if (fakeInputI !== -1) {
    inputPath = `${++lastExecId}_temp`;
    await writeFile(inputPath, input);
    args[fakeInputI] = inputPath;
  }
  if (fakeOutputI !== -1) {
    outputPath = `${++lastExecId}_temp`;
    await writeFile(outputPath, '');
    args[fakeOutputI] = outputPath;
  }
  const deleteTempFiles = async () => {
    if (inputPath) await rm(inputPath, { recursive: true, force: true });
    if (outputPath) await rm(outputPath, { recursive: true, force: true });
  };
  const { stdout } = await execa(
    bin,
    args,
    inputPath ? undefined : { input, encoding: null, maxBuffer: Number.POSITIVE_INFINITY },
  );
  if (outputPath)
    return readFile(outputPath).then(async (a) => {
      await deleteTempFiles();
      return a;
    });
  await deleteTempFiles();
  return stdout;
}

export const wait = (time: number) => new Promise((r) => setTimeout(r, time));

export async function retry<T>(fn: () => Promise<T>, retries: number, interval: number | number[] = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await wait(Array.isArray(interval) ? interval.reverse()[retries - 1]! : interval);
    return retry(fn, retries - 1);
  }
}

export function log(...agrs: unknown[]) {
  console.log(new Date().toLocaleString('ru'), ...agrs);
}

export function formatBytes(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (!bytes) return `0B`;
  const pow = Math.floor(Math.log(bytes) / Math.log(1024));
  const maxPow = Math.min(pow, sizes.length - 1);
  return `${Number.parseFloat((bytes / Math.pow(1024, maxPow)).toFixed(2))}${sizes[maxPow]!}`;
}

export class ValidationError extends Error {
  override name = 'ValidationError';
}

export class HTTPError extends Error {
  code: number;
  body?: Buffer | string | unknown;
  constructor(msg: string, code: number, body?: Buffer | string | unknown) {
    super(msg);
    this.code = code;
    this.body = body;
  }
  override name = 'HTTPError';
}

export const camelToSnakeCase = (str: string) => str.replace(/[A-Z]+/g, (letter) => `_${letter.toLowerCase()}`);

export function parseTime(time: number) {
  const ranges = [
    [31_536_000_000, 'y'],
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'm'],
    [1000, 's'],
    [1, 'ms'],
  ] as const;
  let output = '';
  for (const [ms, title] of ranges) {
    if (time < ms) continue;
    const val = Math.floor(time / ms);
    if (val !== 0) output += ` ${val}${title}`;
    time %= ms;
  }
  return output;
}

export function* chunkifyBuffer(buffer: Buffer, chunkSize = 65_536) {
  for (let pos = 0; pos < buffer.byteLength; pos += chunkSize) yield buffer.subarray(pos, pos + chunkSize);
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};
