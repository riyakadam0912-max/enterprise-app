import { StreamableFile } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  const context = {} as never;

  it('passes StreamableFile responses through unchanged', async () => {
    const streamableFile = new StreamableFile(Buffer.from('file'));
    const interceptor = new TransformInterceptor<StreamableFile>();
    const next = { handle: () => of(streamableFile) };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toBe(streamableFile);
  });

  it('wraps ordinary responses in the API envelope', async () => {
    const interceptor = new TransformInterceptor<{ value: string }>();
    const next = { handle: () => of({ value: 'ok' }) };

    const result = await firstValueFrom(interceptor.intercept(context, next));

    expect(result).toEqual({
      success: true,
      message: 'Request successful',
      data: { value: 'ok' },
    });
  });
});
