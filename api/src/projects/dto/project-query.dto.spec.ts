import { ValidationPipe } from '@nestjs/common';
import { ProjectQueryDto } from './project-query.dto';

describe('ProjectQueryDto', () => {
  it('accepts and transforms supported query fields with strict whitelist validation', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        {
          page: '2',
          pageSize: '25',
          search: 'website',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          managerId: '4',
          startFrom: '2026-01-01',
          endTo: '2026-12-31',
          sortBy: 'projectName',
          sortDirection: 'asc',
        },
        { type: 'query', metatype: ProjectQueryDto, data: undefined },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 25,
        search: 'website',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        managerId: 4,
        startFrom: '2026-01-01',
        endTo: '2026-12-31',
        sortBy: 'projectName',
        sortDirection: 'asc',
      }),
    );
  });
});
