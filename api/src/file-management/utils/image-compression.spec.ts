import sharp from 'sharp';
import {
  MAX_COMPRESSED_IMAGE_BYTES,
  compressImage,
} from './image-compression';

describe('image compression', () => {
  it('compresses raster images to the configured maximum size', async () => {
    const source = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 160, g: 90, b: 40 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();

    const compressed = await compressImage(source, 'image/jpeg');
    const metadata = await sharp(compressed).metadata();

    expect(compressed.byteLength).toBeLessThanOrEqual(
      MAX_COMPRESSED_IMAGE_BYTES,
    );
    expect(metadata.format).toBe('jpeg');
  });

  it('does not modify non-compressible files', async () => {
    const source = Buffer.from('not an image');

    await expect(compressImage(source, 'application/pdf')).resolves.toBe(source);
  });
});
