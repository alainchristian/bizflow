import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { CatalogItemType } from '../catalog-item-type.enum.js';

export class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CatalogItemType)
  type?: CatalogItemType;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceAmount?: number;

  @IsOptional()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, { message: 'currencyCode must be a 3-letter uppercase ISO 4217 code' })
  currencyCode?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
