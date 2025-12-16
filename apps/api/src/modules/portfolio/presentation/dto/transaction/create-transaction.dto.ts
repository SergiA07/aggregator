import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  DIVIDEND = 'dividend',
  FEE = 'fee',
  SPLIT = 'split',
  OTHER = 'other',
}

export class CreateTransactionDto {
  @ApiProperty({ description: 'Account UUID' })
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'Security UUID' })
  @IsUUID()
  @IsNotEmpty()
  securityId: string;

  @ApiProperty({ example: '2024-01-15', description: 'Transaction date (ISO format)' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ enum: TransactionType, example: 'buy' })
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @ApiProperty({ example: 10.5, description: 'Number of shares' })
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ example: 150.25, description: 'Price per share' })
  @IsNumber()
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: 1577.63, description: 'Total transaction amount' })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ example: 2.5, default: 0, description: 'Transaction fees' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fees?: number;

  @ApiPropertyOptional({ example: 'EUR', default: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Monthly investment', description: 'Transaction notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'External ID from broker for deduplication' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalId?: string;
}
