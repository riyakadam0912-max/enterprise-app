import { api } from './client';
import { updateLead, importLeads, removeContact, updateInvoice, sendInvoice, deleteInvoice, updatePayment, paymentsByInvoice, previewFile, downloadFile, updateFile, filesByEntity, updateFormSubmission, deleteFormSubmission, createDynamicForm, updateDynamicForm, removeDynamicForm } from './api-index';

jest.mock('./client', () => ({
  api: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  unwrap: (value: unknown) => value,
}));

const mockedApi = api as unknown as { post: jest.Mock; get: jest.Mock; patch: jest.Mock; delete: jest.Mock };

beforeEach(() => jest.clearAllMocks());

test('routes CRM and billing updates to the exact backend endpoints', async () => {
  mockedApi.patch.mockResolvedValue({ data: { id: 2, name: 'Updated lead' } });
  mockedApi.post.mockResolvedValue({ data: { ok: true } });
  mockedApi.delete.mockResolvedValue({ data: { ok: true } });
  mockedApi.get.mockImplementation(async (path: string) => ({
    data: path === '/payments/invoice/9' ? [{ id: 1, invoiceId: 9, status: 'PAID' }] : { id: 2, status: 'PAID' },
  }));

  await updateLead(2, { name: 'Updated lead', status: 'QUALIFIED' });
  await importLeads([{ name: 'Imported lead' }]);
  await removeContact(5);
  await updateInvoice(9, { status: 'PAID' });
  await sendInvoice(9, { subject: 'Invoice reminder' });
  await deleteInvoice(9);
  await updatePayment(12, { status: 'PAID' });
  await paymentsByInvoice(9);

  expect(mockedApi.patch).toHaveBeenNthCalledWith(1, '/leads/2', { name: 'Updated lead', status: 'QUALIFIED' });
  expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/leads/import', { records: [{ name: 'Imported lead' }] });
  expect(mockedApi.delete).toHaveBeenNthCalledWith(1, '/contacts/5');
  expect(mockedApi.patch).toHaveBeenNthCalledWith(2, '/invoices/9', { status: 'PAID' });
  expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/invoices/9/send', { subject: 'Invoice reminder' });
  expect(mockedApi.delete).toHaveBeenNthCalledWith(2, '/invoices/9');
  expect(mockedApi.patch).toHaveBeenNthCalledWith(3, '/payments/12', { status: 'PAID' });
  expect(mockedApi.get).toHaveBeenCalledWith('/payments/invoice/9');
});

test('routes file and form actions to the authenticated access routes', async () => {
  mockedApi.get.mockResolvedValue({ data: { id: 8 } });
  mockedApi.patch.mockResolvedValue({ data: { id: 8, category: 'Finance' } });
  mockedApi.delete.mockResolvedValue({ data: { ok: true } });
  mockedApi.post.mockResolvedValue({ data: { id: 3, formName: 'Safety form' } });

  await filesByEntity('Organization', 7);
  await previewFile(8);
  await downloadFile(8);
  await updateFile(8, { category: 'Finance' });
  await updateFormSubmission(4, { status: 'PROCESSED' });
  await deleteFormSubmission(4);
  await createDynamicForm({ formName: 'Safety form', targetModule: 'HR' });
  await updateDynamicForm(3, { formName: 'Updated safety form' });
  await removeDynamicForm(3);

  expect(mockedApi.get).toHaveBeenNthCalledWith(1, '/files/entity/Organization/7');
  expect(mockedApi.get).toHaveBeenNthCalledWith(2, '/files/preview/8');
  expect(mockedApi.get).toHaveBeenNthCalledWith(3, '/files/download/8');
  expect(mockedApi.patch).toHaveBeenNthCalledWith(1, '/files/8', { category: 'Finance' });
  expect(mockedApi.patch).toHaveBeenNthCalledWith(2, '/form-submissions/4', { status: 'PROCESSED' });
  expect(mockedApi.delete).toHaveBeenNthCalledWith(1, '/form-submissions/4');
  expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/dynamic-forms', { formName: 'Safety form', targetModule: 'HR' });
  expect(mockedApi.patch).toHaveBeenNthCalledWith(3, '/dynamic-forms/3', { formName: 'Updated safety form' });
  expect(mockedApi.delete).toHaveBeenNthCalledWith(2, '/dynamic-forms/3');
});
