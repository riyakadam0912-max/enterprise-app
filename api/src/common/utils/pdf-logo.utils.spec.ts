import sharp from 'sharp';
import { loadPdfLogo } from './pdf-logo.utils';

describe('loadPdfLogo', () => {
  it('normalizes a supported data URL for PDF embedding', async () => {
    const source = await sharp({
      create: {
        width: 12,
        height: 12,
        channels: 4,
        background: '#315B50',
      },
    })
      .png()
      .toBuffer();
    const result = await loadPdfLogo(
      `data:image/png;base64,${source.toString('base64')}`,
    );

    expect(result?.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });

  it('ignores unsupported and unsafe logo URLs', async () => {
    await expect(
      loadPdfLogo('http://127.0.0.1/logo.png'),
    ).resolves.toBeUndefined();
    await expect(
      loadPdfLogo('data:image/svg+xml;base64,PHN2Zy8+'),
    ).resolves.toBeUndefined();
  });
});
