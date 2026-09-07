import { prepareServerlessRequestBody } from './vercel-request-body';

describe('prepareServerlessRequestBody', () => {
  it('parses JSON bodies emitted by Vercel request streams', async () => {
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from('{"email":"admin@erp.local","password":"Admin@123"}');
      },
    } as any;

    const parsed = await prepareServerlessRequestBody(req);

    expect(parsed).toEqual({
      email: 'admin@erp.local',
      password: 'Admin@123',
    });
    expect(req.body).toBeUndefined();
  });

  it('keeps an already-parsed object body intact', async () => {
    const body = { email: 'admin@erp.local', password: 'Admin@123' };
    const req = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    } as any;

    await expect(prepareServerlessRequestBody(req)).resolves.toEqual(body);
  });

  it('leaves multipart request streams untouched for Multer', async () => {
    let streamRead = false;
    const req = {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=test' },
      async *[Symbol.asyncIterator]() {
        streamRead = true;
        yield Buffer.from('file data');
      },
    } as any;

    await expect(prepareServerlessRequestBody(req)).resolves.toBeUndefined();
    expect(streamRead).toBe(false);
  });
});
