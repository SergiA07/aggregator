import type { MultipartFile } from '@fastify/multipart';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  FILE_UPLOAD,
  formatMaxFileSize,
  isAllowedExtension,
  isAllowedMimeType,
} from '@repo/shared-types/validation';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';
import { ImportTransactionsUseCase } from '../../application/use-cases';

// Extend FastifyRequest to include multipart file method
interface FastifyMultipartRequest extends FastifyRequest {
  file: () => Promise<MultipartFile | undefined>;
}

class ImportCsvDto {
  @IsOptional()
  @IsString()
  broker?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

/** DTO for Trade Republic transaction from API sync */
class TRTransactionDto {
  @IsString()
  date: string;

  @IsString()
  @IsIn(['buy', 'sell', 'dividend', 'interest', 'fee', 'split', 'other'])
  type: 'buy' | 'sell' | 'dividend' | 'interest' | 'fee' | 'split' | 'other';

  @IsOptional()
  @IsString()
  isin?: string;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  price: number;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsNumber()
  fees?: number;

  @IsString()
  currency: string;
}

/** DTO for Trade Republic position from API sync */
class TRPositionDto {
  @IsOptional()
  @IsString()
  isin?: string;

  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  avgCost: number;

  @IsString()
  currency: string;
}

/** DTO for cash balance from API sync */
class TRCashBalanceDto {
  @IsString()
  currency: string;

  @IsNumber()
  amount: number;
}

/** DTO for Trade Republic API sync import */
class ImportTradeRepublicDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TRTransactionDto)
  transactions: TRTransactionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TRPositionDto)
  positions: TRPositionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TRCashBalanceDto)
  cashBalances?: TRCashBalanceDto[];
}

@ApiTags('Portfolio Import')
@ApiBearerAuth()
@Controller('import')
@UseGuards(SupabaseAuthGuard)
export class ImportController {
  constructor(
    @Inject(ImportTransactionsUseCase)
    private readonly importUseCase: ImportTransactionsUseCase,
  ) {}

  @Get('brokers')
  @ApiOperation({ summary: 'Get list of supported brokers for investments' })
  @ApiResponse({ status: 200, description: 'List of supported brokers returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  getSupportedBrokers() {
    return {
      investment: this.importUseCase.getSupportedBrokers(),
    };
  }

  @Post('csv')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 imports per minute per user
  @ApiOperation({ summary: 'Import CSV content directly' })
  @ApiResponse({ status: 201, description: 'CSV imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid CSV content or format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async importCSV(@CurrentUser() user: AuthUser, @Body() dto: ImportCsvDto) {
    return this.importUseCase.execute(user.id, dto.content, dto.filename, dto.broker);
  }

  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 uploads per minute per user
  @ApiOperation({ summary: 'Import CSV file upload' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        broker: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type, empty file, or invalid content' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async importFile(@CurrentUser() user: AuthUser, @Req() req: FastifyMultipartRequest) {
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('File is required');
    }

    const filename = data.filename;

    // Validate file extension
    if (!isAllowedExtension(filename)) {
      throw new BadRequestException(
        `Invalid file type. Allowed extensions: ${FILE_UPLOAD.ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    // Validate MIME type (with fallback for missing mimetype)
    if (!isAllowedMimeType(data.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Received: ${data.mimetype}. Expected a CSV, text, or Excel file.`,
      );
    }

    const buffer = await data.toBuffer();

    // Validate file size
    if (buffer.length > FILE_UPLOAD.MAX_SIZE) {
      throw new PayloadTooLargeException(`File too large. Maximum size is ${formatMaxFileSize()}.`);
    }

    // Validate file is not empty
    if (buffer.length === 0) {
      throw new BadRequestException('File is empty');
    }

    // Parse form fields
    const fields = data.fields as Record<string, { value?: string }>;
    const broker = fields.broker?.value;

    // Determine content based on file type
    let content: string;
    const isExcelFile =
      filename.toLowerCase().endsWith('.xls') || filename.toLowerCase().endsWith('.xlsx');

    if (isExcelFile) {
      // For Excel files, pass the buffer as binary string
      // The parser will handle the actual XLS parsing
      content = buffer.toString('binary');
    } else {
      // For CSV/text files, try different encodings
      try {
        content = buffer.toString('utf-8');
      } catch {
        try {
          content = buffer.toString('latin1');
        } catch {
          content = buffer.toString();
        }
      }

      // Basic content validation for text files
      const lines = content.trim().split('\n');
      if (lines.length < 1 || !lines[0].trim()) {
        throw new BadRequestException('File contains no valid content');
      }
    }

    return this.importUseCase.execute(user.id, content, filename, broker);
  }

  @Post('trade-republic')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 syncs per minute per user
  @ApiOperation({ summary: 'Import Trade Republic data from API sync' })
  @ApiResponse({ status: 201, description: 'Trade Republic data imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async importTradeRepublic(@CurrentUser() user: AuthUser, @Body() dto: ImportTradeRepublicDto) {
    // Transform DTO to ParseResult format
    const parseResult = {
      broker: 'trade-republic',
      errors: [] as string[],
      transactions: dto.transactions.map((tx) => ({
        date: new Date(tx.date),
        type: tx.type,
        symbol: tx.isin || tx.name.substring(0, 10).toUpperCase(),
        isin: tx.isin,
        name: tx.name,
        quantity: tx.quantity,
        price: tx.price,
        amount: tx.amount,
        fees: tx.fees || 0,
        currency: tx.currency,
      })),
      positions: dto.positions.map((pos) => ({
        symbol: pos.isin || pos.name.substring(0, 10).toUpperCase(),
        isin: pos.isin,
        name: pos.name,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        totalCost: pos.quantity * pos.avgCost,
        currency: pos.currency,
      })),
      cashBalances: dto.cashBalances?.map((cash) => ({
        currency: cash.currency,
        amount: cash.amount,
      })),
    };

    return this.importUseCase.executeFromParsedData(user.id, parseResult);
  }
}
