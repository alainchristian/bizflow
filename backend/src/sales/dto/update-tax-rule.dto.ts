import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateTaxRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBasisPoints?: number;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
