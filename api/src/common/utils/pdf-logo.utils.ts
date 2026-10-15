import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import sharp from 'sharp';

const MAX_LOGO_BYTES = 512 * 1024;
const MAX_LOGO_PIXELS = 4_000_000;

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split('.').map(Number);
    const [first, second] = octets;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return (
      (firstHextet & 0xe000) === 0x2000 && !normalized.startsWith('2001:db8:')
    );
  }

  return false;
}

async function readLogoSource(logoUrl: string): Promise<Buffer> {
  if (logoUrl.startsWith('data:image/')) {
    const match = logoUrl.match(
      /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/,
    );
    if (!match) throw new Error('Unsupported logo data URL');
    if (match[1].length > Math.ceil(MAX_LOGO_BYTES / 3) * 4) {
      throw new Error('Logo exceeds the maximum size');
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (buffer.byteLength > MAX_LOGO_BYTES) {
      throw new Error('Logo exceeds the maximum size');
    }
    return buffer;
  }

  const url = new URL(logoUrl);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Organization logos must use a public HTTPS URL');
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error('Logo URL must resolve to a public host');
  }

  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(4000),
  });
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (
    !response.ok ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(contentType ?? '')
  ) {
    throw new Error('Logo URL did not return a supported image');
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > MAX_LOGO_BYTES) {
    throw new Error('Logo exceeds the maximum size');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_LOGO_BYTES) {
    throw new Error('Logo exceeds the maximum size');
  }
  return buffer;
}

export async function loadPdfLogo(
  logoUrl?: string | null,
): Promise<Buffer | undefined> {
  if (!logoUrl?.trim()) return undefined;

  try {
    const source = await readLogoSource(logoUrl.trim());
    const image = sharp(source, {
      failOn: 'error',
      limitInputPixels: MAX_LOGO_PIXELS,
    });
    const metadata = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) {
      return undefined;
    }
    return image
      .rotate()
      .resize({
        width: 480,
        height: 240,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch {
    return undefined;
  }
}
