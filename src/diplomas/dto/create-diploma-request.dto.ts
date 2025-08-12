import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateDiplomaRequestDto {
  @IsUUID()
  diplomaId: string;

  @IsArray()
  @IsUUID(4, { each: true })
  studentIds: string[];

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @IsUUID(4, { each: true })
  requiredSignatures: string[];
}
