import { NotFoundException } from '@nestjs/common';
import { ModuleQueryDto } from '../dto/module-query.dto';
import {
  buildModulePaginationMeta,
  normalizeModuleQuery,
} from '../utils/module-pagination';
import type { ModuleListResult } from '../interfaces/module-list.interface';

export abstract class StandardModuleService<
  TRecord,
  TCreateDto,
  TUpdateDto,
  TCreateInput = TCreateDto,
  TUpdateInput = TUpdateDto,
> {
  protected abstract readonly entityName: string;

  protected abstract listRecords(
    query: ModuleQueryDto,
  ): Promise<{ items: TRecord[]; total: number }>;

  protected abstract findRecord(id: number): Promise<TRecord | null>;

  protected abstract createRecord(data: TCreateInput): Promise<TRecord>;

  protected abstract updateRecord(
    id: number,
    data: TUpdateInput,
  ): Promise<TRecord>;

  protected abstract removeRecord(id: number): Promise<void | TRecord>;

  protected buildCreateData(
    dto: TCreateDto,
  ): TCreateInput | Promise<TCreateInput> {
    return dto as unknown as TCreateInput;
  }

  protected buildUpdateData(
    dto: TUpdateDto,
  ): TUpdateInput | Promise<TUpdateInput> {
    return dto as unknown as TUpdateInput;
  }

  protected notFound(id: number): NotFoundException {
    return new NotFoundException(`${this.entityName} #${id} not found`);
  }

  protected async ensureExists(id: number): Promise<TRecord> {
    const record = await this.findRecord(id);
    if (!record) {
      throw this.notFound(id);
    }

    return record;
  }

  async findAll(
    query: ModuleQueryDto = new ModuleQueryDto(),
  ): Promise<ModuleListResult<TRecord>> {
    const normalizedQuery = normalizeModuleQuery(query);
    const { items, total } = await this.listRecords({
      ...query,
      ...normalizedQuery,
    });

    return {
      items,
      meta: buildModulePaginationMeta(
        total,
        normalizedQuery.page,
        normalizedQuery.limit,
      ),
    };
  }

  async findOne(id: number): Promise<TRecord> {
    const record = await this.findRecord(id);
    if (!record) {
      throw this.notFound(id);
    }

    return record;
  }

  async create(dto: TCreateDto): Promise<TRecord> {
    return this.createRecord(await this.buildCreateData(dto));
  }

  async update(id: number, dto: TUpdateDto): Promise<TRecord> {
    await this.ensureExists(id);
    return this.updateRecord(id, await this.buildUpdateData(dto));
  }

  async remove(id: number): Promise<void | TRecord> {
    await this.ensureExists(id);
    return this.removeRecord(id);
  }
}
