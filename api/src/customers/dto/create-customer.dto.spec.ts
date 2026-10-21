import { validate } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  it('requires a non-empty customer name', async () => {
    const dto = Object.assign(new CreateCustomerDto(), { customerName: '  ' });

    const errors = await validate(dto);
    const nameError = errors.find((error) => error.property === 'customerName');

    expect(nameError).toBeDefined();
  });

  it('allows creation with only a customer name', async () => {
    const dto = Object.assign(new CreateCustomerDto(), {
      customerName: 'Acme Corporation',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('does not apply email or web address format constraints', async () => {
    const dto = Object.assign(new CreateCustomerDto(), {
      customerName: 'Acme Corporation',
      webAddress: 'website without a protocol',
      email: 'not-an-email',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
