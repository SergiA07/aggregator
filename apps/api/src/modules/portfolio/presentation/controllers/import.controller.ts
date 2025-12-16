import type { MultipartFile } from '@fastify/multipart';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';
import { ImportTransactionsUseCase } from '../../application/use-cases';

// Extend FastifyRequest to include multipart file method
interface FastifyMultipartRequest extends FastifyRequest {
  file: () => Promise<MultipartFile | undefined>;
}

class ImportCsvDto {
  broker?: string;
  content: string;
  filename?: string;
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
  getSupportedBrokers() {
    return {
      investment: this.importUseCase.getSupportedBrokers(),
    };
  }

  @Post('csv')
  @ApiOperation({ summary: 'Import CSV content directly' })
  async importCSV(@CurrentUser() user: AuthUser, @Body() dto: ImportCsvDto) {
    return this.importUseCase.execute(user.id, dto.content, dto.filename, dto.broker);
  }

  @Post('upload')
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
  async importFile(@CurrentUser() user: AuthUser, @Req() req: FastifyMultipartRequest) {
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('File is required');
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;

    // Parse form fields
    const fields = data.fields as Record<string, { value?: string }>;
    const broker = fields.broker?.value;

    // Try different encodings
    let content: string;
    try {
      content = buffer.toString('utf-8');
    } catch {
      try {
        content = buffer.toString('latin1');
      } catch {
        content = buffer.toString();
      }
    }

    return this.importUseCase.execute(user.id, content, filename, broker);
  }
}
