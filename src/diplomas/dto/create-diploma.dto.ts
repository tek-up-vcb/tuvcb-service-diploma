import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export class CreateDiplomaDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  level: string;

  @IsString()
  field: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
