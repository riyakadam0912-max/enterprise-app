import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}