import { validate } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  it('allows a missing web address', async () => {
    const dto = new CreateCustomerDto();

    const errors = await validate(dto);
    const webAddressError = errors.find((error) => error.property === 'webAddress');

    expect(webAddressError).toBeUndefined();
  });

  it('validates a supplied web address', async () => {
    const dto = Object.assign(new CreateCustomerDto(), { webAddress: 'not-a-url' });

    const errors = await validate(dto);
    const webAddressError = errors.find((error) => error.property === 'webAddress');

    expect(webAddressError?.constraints).toHaveProperty('isUrl');
  });
});