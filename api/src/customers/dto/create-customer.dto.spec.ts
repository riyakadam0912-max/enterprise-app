import { validate } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

describe('CreateCustomerDto', () => {
  it('requires a web address', async () => {
    const dto = new CreateCustomerDto();

    const errors = await validate(dto);
    const webAddressError = errors.find((error) => error.property === 'webAddress');

    expect(webAddressError?.constraints).toHaveProperty('isUrl');
  });
});