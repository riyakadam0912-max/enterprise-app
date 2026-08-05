import { validate } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';

describe('CreateTaskDto', () => {
  it('accepts taskName when title is omitted', async () => {
    const dto = new CreateTaskDto();
    dto.taskName = 'Smoke test task';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
