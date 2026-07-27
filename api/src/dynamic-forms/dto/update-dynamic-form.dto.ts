import { PartialType } from '@nestjs/mapped-types';
import { CreateDynamicFormDto } from './create-dynamic-form.dto';

export class UpdateDynamicFormDto extends PartialType(CreateDynamicFormDto) {}
