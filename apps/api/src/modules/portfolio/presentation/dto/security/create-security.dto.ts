import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSecurityDto {
  @ApiProperty({ example: 'AAPL', description: 'Ticker symbol' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  symbol: string;

  @ApiPropertyOptional({ example: 'US0378331005', description: 'ISIN identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  isin?: string;

  @ApiProperty({ example: 'Apple Inc.', description: 'Security name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'stock', description: 'Security type (stock, etf, bond, fund)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  securityType: string;

  @ApiPropertyOptional({ example: 'USD', default: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'NASDAQ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  exchange?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sector?: string;

  @ApiPropertyOptional({ example: 'Consumer Electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}
