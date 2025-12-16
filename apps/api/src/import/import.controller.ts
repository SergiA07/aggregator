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
import type { User } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';

// Extend FastifyRequest to include multipart file method
interface FastifyMultipartRequest extends FastifyRequest {
  file: () => Promise<MultipartFile | undefined>;
}
import { CurrentUser, SupabaseAuthGuard } from '../auth';
import { ImportService } from './import.service';

interface ImportFileBody {
  content: string;
  filename?: string;
  broker?: string;
  type?: 'investment' | 'bank';
}

@ApiTags('Import')
@ApiBearerAuth()
@Controller('import')
@UseGuards(SupabaseAuthGuard)
export class ImportController {
  constructor(@Inject(ImportService) private readonly importService: ImportService) {}

  @Get('brokers')
  @ApiOperation({ summary: 'Get list of supported brokers' })
  getSupportedBrokers() {
    return {
      investment: this.importService.getSupportedBrokers().filter((b) => b !== 'sabadell'),
      bank: ['sabadell'],
    };
  }

  @Post('csv')
  @ApiOperation({ summary: 'Import CSV content directly' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', description: 'CSV file content' },
        filename: { type: 'string', description: 'Original filename (helps detect broker)' },
        broker: { type: 'string', description: 'Force specific broker parser' },
        type: { type: 'string', enum: ['investment', 'bank'], description: 'Import type' },
      },
    },
  })
  async importCSV(@CurrentUser() user: User, @Body() body: ImportFileBody) {
    if (!body.content) {
      throw new BadRequestException('CSV content is required');
    }

    if (body.type === 'bank') {
      return this.importService.importBankCSV(user.id, body.content, body.filename);
    }

    return this.importService.importCSV(user.id, body.content, body.filename, body.broker);
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
        type: { type: 'string', enum: ['investment', 'bank'] },
      },
    },
  })
  async importFile(@CurrentUser() user: User, @Req() req: FastifyMultipartRequest) {
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('File is required');
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;

    // Parse form fields
    const fields = data.fields as Record<string, { value?: string }>;
    const broker = fields.broker?.value;
    const type = fields.type?.value;

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

    if (type === 'bank') {
      return this.importService.importBankCSV(user.id, content, filename);
    }

    return this.importService.importCSV(user.id, content, filename, broker);
  }
}
