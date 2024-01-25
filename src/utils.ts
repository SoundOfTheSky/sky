/**
 * Collection of pure utils for my code.
 */

// === Types ===
export type MakeOptional<Type, Key extends keyof Type> = Omit<Type, Key> & Partial<Pick<Type, Key>>;

// === Errors ===
/** Says that an error is by-design */
export class ValidationError extends Error {
  override name = 'ValidationError';
}

// === Formatting and logging ===
/** Milliseconds to human readable time. Minimum accuracy, if set to 1000 will stop at seconds  */
export function formatTime(time: number, min = 1) {
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
    if (min && time < min) break;
    if (time < ms) continue;
    const val = Math.floor(time / ms);
    if (val !== 0) output += ` ${val}${title}`;
    time %= ms;
  }
  return output;
}
/** Format HTML to simple string */
export function cleanupHTML(
  text: string,
  whitelist: string[] = [
    'accent', // Current subject [any]
    'subject', // Link another subject [any](uid=number)
    'example', // example sentence? [any]
    'audio', // Audio [any] (s="link")
    'warning', // Warning text [any]
    'ik', // ImmersionKit query [text]
    'tab', // Tabs always at root [any] title="text"
    'img',
    'ruby',
    'rt',
    'rp',
    'a',
  ],
) {
  // Split <br> as \n and trim lines
  text = text
    .replaceAll(/<br>/gs, '\n')
    .split('\n')
    .map((el) => el.trim())
    .join('\n')
    .replaceAll(/\s{2,}/g, '\n');

  return ([...text.matchAll(/<.+?>/g)].map((el) => [el[0].slice(1, -1).split(' ')[0], el.index]) as [string, number][])
    .filter(([t]) => whitelist.every((w) => t !== w && t !== `/${w}`))
    .reverse()
    .reduce((acc, [, index]) => acc.slice(0, index) + acc.slice(acc.indexOf('>', index) + 1), text);
}
/** thisCase to this-case */
export const camelToSnakeCase = (str: string) => str.replaceAll(/[A-Z]+/g, (letter) => `_${letter.toLowerCase()}`);
/**Bytes to KB,MB,GB,TB */
export function formatBytes(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (!bytes) return `0B`;
  const pow = Math.floor(Math.log(bytes) / Math.log(1024));
  const maxPow = Math.min(pow, sizes.length - 1);
  return `${Number.parseFloat((bytes / Math.pow(1024, maxPow)).toFixed(2))}${sizes[maxPow]}`;
}
/** Logger (adds date to log)*/
export function log(...agrs: unknown[]) {
  console.log(new Date().toLocaleString('ru'), ...agrs);
}
/** Can pass streams through to log the progress */
export class ProgressLoggerTransform<T extends { length: number }> extends TransformStream<T> {
  constructor(str: string, logInterval: number, maxSize?: number) {
    let bytes = 0;
    const start = Date.now();
    let lastBytes = 0;
    super({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        bytes += chunk.length;
      },
      flush() {
        clearInterval(interval);
        log('Done!');
      },
    });
    const interval = setInterval(() => {
      let msg = str;
      const speed = (bytes - lastBytes) / logInterval;
      msg = msg
        .replace('%b', formatBytes(bytes))
        .replace('%t', formatTime(Date.now() - start, 1000))
        .replace('%s', formatBytes(speed));
      if (maxSize) {
        msg = msg
          .replace('%lt', formatTime(~~((maxSize - bytes) / speed) * 1000))
          .replace('%p', (~~((bytes / maxSize) * 100)).toString())
          .replace('%s', formatBytes(maxSize));
      }
      log(msg);
      lastBytes = bytes;
    }, logInterval * 1000);
  }
}

// === Arrays ===
/** Random number between min and max. May enable float */
export function random(min: number, max: number, float?: boolean): number {
  const number_ = Math.random() * (max - min) + min;
  return float ? number_ : Math.round(number_);
}
/** Create new shuffled array */
export function shuffleArray<T>(arr: T[]): T[] {
  const array = [...arr];
  for (let i = 0; i < array.length; i++) {
    const i2 = Math.floor(Math.random() * array.length);
    const buf = array[i2];
    array[i2] = array[i]!;
    array[i] = buf;
  }
  return array;
}
/** Swap two elements in array */
export function swap<T>(arr: T[], i: number, i2: number) {
  const temp = arr[i2];
  arr[i2] = arr[i]!;
  arr[i] = temp;
  return arr;
}
/**
 * Binary search in sorted array.
 * Compare function should compare your needed value with value on index passed to it.
 * If compare returns 0 it means we found target.
 * If compare returns >0 it means we have to cut out bigger side of array.
 * If compare returns <0 it means we have to cut out smaller side of array.
 */
export function binarySearch(size: number, compare: (index: number) => number) {
  let low = 0;
  let high = size - 1;
  let position = -1;
  while (low <= high) {
    const mid = ~~((low + high) / 2);
    const compared = compare(mid);
    if (compared === 0) {
      position = mid;
      break;
    } else if (compared > 0) high = mid - 1;
    else low = mid + 1;
  }
  return position;
}

// === Control ===
/**
 * Creates cached function. All arguments/results are cached.
 * Returns [
 *  fn [cached function],
 *  delete [delete cached result for arguments]
 *  hash
 * ]
 */
export function createCashedFunction<T, V extends unknown[]>(fn: (...args: V) => T) {
  const hash = new Map<string, T>();
  return [
    (...args: V) => {
      const key = JSON.stringify(args);
      const value = hash.get(key);
      if (value) return value;
      const newValue = fn(...args);
      hash.set(key, newValue);
      return newValue;
    },
    (...args: V) => hash.delete(JSON.stringify(args)),
    hash,
  ] as const;
}
/**
 * Creates cached function. All arguments/results are cached. Will store in cache resolved data.
 * Returns [
 *  fn [cached function],
 *  delete [delete cached result for arguments]
 *  hash
 * ]
 */
export function createCashedAsyncFunction<T, V extends unknown[]>(fn: (...args: V) => Promise<T>) {
  const hash = new Map<string, T>();
  return [
    async (...args: V) => {
      const key = JSON.stringify(args);
      const value = hash.get(key);
      if (value) return value;
      const newValue = await fn(...args);
      hash.set(key, newValue);
      return newValue;
    },
    (...args: V) => hash.delete(JSON.stringify(args)),
    hash,
  ] as const;
}
/** Retry async function */
export async function retry<T>(fn: () => Promise<T>, retries: number, interval: number | number[] = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await wait(Array.isArray(interval) ? interval[interval.length - retries] : interval);
    return retry(fn, retries - 1, interval);
  }
}
/** setTimeout promisify */
export const wait = (time: number) => new Promise((r) => setTimeout(r, time));
/** Empty function that does nothing */
export const noop = () => {};
