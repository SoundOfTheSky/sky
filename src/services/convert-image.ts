import FileType from 'file-type';
import { execBuffer, ValidationError } from '../utils';

export async function convertImage(buffer: Buffer, from: string, to: string): Promise<Buffer> {
  if (from === 'gif' && to === 'webp')
    return execBuffer('gif2webp', buffer, ['-mt', '-quiet', '-metadata', 'none', '-o', 'OUTPUT_PATH', 'INPUT_PATH']);
  if (from === 'gif' && to === 'gif')
    return execBuffer('gifsicle', buffer, ['--no-warnings', '--no-app-extensions', '--optimize=3']);
  return execBuffer('magick', buffer, ['-', to + ':-']);
}
export async function optimizeImage(buffer: Buffer, ext?: string) {
  if (!ext) {
    const _from = await FileType.fromBuffer(buffer);
    if (!_from) throw new ValidationError('Unknown format');
    ext = _from.ext;
  }
  if (OPTIMIZABLE_IMAGES.includes(ext)) return convertImage(buffer, ext, 'webp');
  return buffer;
}
export const OPTIMIZABLE_IMAGES = ['gif', 'jpg', 'jpeg', 'png', 'heic', 'bmp'];
