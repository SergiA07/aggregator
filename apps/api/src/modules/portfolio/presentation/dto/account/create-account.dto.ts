import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ example: 'degiro', description: 'Broker identifier' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  broker: string;

  @ApiProperty({ example: 'ACC-12345', description: 'External account ID from broker' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountId: string;

  @ApiPropertyOptional({ example: 'My DeGiro Account', description: 'Custom account name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountName?: string;

  @ApiPropertyOptional({ example: 'EUR', default: 'EUR', description: 'Account currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
