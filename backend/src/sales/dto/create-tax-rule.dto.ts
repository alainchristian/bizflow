import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateTaxRuleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Basis points: 725 = 7.25%. Capped at 10000 (100%) -- a rate above that is never legitimate. */
  @IsInt()
  @Min(0)
  @Max(10000)
  rateBasisPoints!: number;

  @IsOptional()
  @IsBoolean()
  isInclusive?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
