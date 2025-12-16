import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'My Main Account', description: 'Custom account name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  accountName?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Account currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}
