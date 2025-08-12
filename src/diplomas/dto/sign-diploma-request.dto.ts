import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class SignDiplomaRequestDto {
  @IsOptional()
  @IsString()
  signatureComment?: string;

  @IsBoolean()
  approve: boolean;
}
