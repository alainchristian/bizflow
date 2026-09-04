import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'countryCode must be a 2-letter uppercase ISO 3166-1 alpha-2 code',
  })
  countryCode!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'baseCurrency must be a 3-letter uppercase ISO 4217 currency code',
  })
  baseCurrency!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  industry?: string;
}
