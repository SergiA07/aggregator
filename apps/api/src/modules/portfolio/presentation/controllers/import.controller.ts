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
import {
  FILE_UPLOAD,
  formatMaxFileSize,
  isAllowedExtension,
  isAllowedMimeType,
} from '@repo/shared-types/validation';
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
  @ApiResponse({ status: 200, description: 'List of supported brokers returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  getSupportedBrokers() {
    return {
      investment: this.importUseCase.getSupportedBrokers(),
    };
  }

  @Post('csv')
  @ApiOperation({ summary: 'Import CSV content directly' })
  @ApiResponse({ status: 201, description: 'CSV imported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid CSV content or format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
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
        `Invalid file type. Received: ${data.mimetype}. Expected a CSV or text file.`,
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

    // Basic content validation - should have at least a header line
    const lines = content.trim().split('\n');
    if (lines.length < 1 || !lines[0].trim()) {
      throw new BadRequestException('File contains no valid content');
    }

    return this.importUseCase.execute(user.id, content, filename, broker);
  }
}
