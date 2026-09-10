import sharp from 'sharp';

export const MAX_COMPRESSED_IMAGE_BYTES = 300 * 1024;
const INITIAL_QUALITY = 80;
const MIN_QUALITY = 20;
const MIN_DIMENSION = 64;

const COMPRESSIBLE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function isCompressibleImage(mimeType: string): boolean {
  return COMPRESSIBLE_IMAGE_TYPES.has(mimeType.toLowerCase());
}

async function encodeImage(
  buffer: Buffer,
  mimeType: string,
  quality: number,
  width?: number,
) {
  let image = sharp(buffer, { failOn: 'none' }).rotate();
  if (width) {
    image = image.resize({ width, withoutEnlargement: true });
  }

  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return image.png({
        compressionLevel: 9,
        palette: true,
        quality,
      }).toBuffer();
    case 'image/webp':
      return image.webp({ quality }).toBuffer();
    default:
      return image.jpeg({ quality, mozjpeg: true }).toBuffer();
  }
}

export async function compressImage(
  buffer: Buffer,
  mimeType: string,
): Promise<Buffer> {
  if (!isCompressibleImage(mimeType)) {
    return buffer;
  }

  const metadata = await sharp(buffer, { failOn: 'none' }).metadata();
  let width = metadata.width;
  let quality = INITIAL_QUALITY;
  let compressed = await encodeImage(buffer, mimeType, quality, width);

  while (compressed.byteLength > MAX_COMPRESSED_IMAGE_BYTES) {
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 10);
    } else if (width && width > MIN_DIMENSION) {
      width = Math.max(MIN_DIMENSION, Math.floor(width * 0.8));
    } else {
      throw new Error('Unable to compress image below the 300 KB limit');
    }

    compressed = await encodeImage(buffer, mimeType, quality, width);
  }

  return compressed;
}
