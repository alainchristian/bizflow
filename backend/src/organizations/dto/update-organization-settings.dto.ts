import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  invoiceNumberPrefix?: string;

  @IsOptional()
  @IsBoolean()
  taxInclusivePricing?: boolean;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
