import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { InjectPinoLogger, type PinoLogger } from 'nestjs-pino';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';

/**
 * Trade Republic Sync Controller
 *
 * Proxies requests to the Python service for Trade Republic authentication.
 * This keeps the Python service API key on the server side (not exposed to frontend).
 *
 * Security:
 * - All endpoints require Supabase authentication
 * - API key for Python service is stored in environment variable
 * - Rate limiting should be applied (TODO: add @nestjs/throttler)
 */

// DTOs for Trade Republic sync
class TRLoginInitDto {
  @IsString()
  @Matches(/^\+[0-9]{10,15}$/, {
    message: 'Invalid phone number format. Must include country code.',
  })
  phone_number: string;

  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'PIN must be exactly 4 digits.' })
  pin: string;
}

class TRLoginCompleteDto {
  @IsString()
  session_id: string;

  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Verification code must be exactly 4 digits.' })
  verify_code: string;
}

class TRResendDto {
  @IsString()
  session_id: string;
}

@ApiTags('Trade Republic Sync')
@ApiBearerAuth()
@Controller('trade-republic')
@UseGuards(SupabaseAuthGuard)
export class TradeRepublicController {
  private readonly pythonServiceUrl: string;
  private readonly pythonServiceApiKey: string;

  constructor(
    @InjectPinoLogger(TradeRepublicController.name)
    private readonly logger: PinoLogger,
    @Inject(ConfigService) configService: ConfigService,
  ) {
    const isProd = configService.get<string>('NODE_ENV') === 'production';
    this.pythonServiceUrl = configService.get<string>(
      'PYTHON_SERVICE_URL',
      'http://localhost:8000',
    );
    const apiKey = configService.get<string>('PYTHON_SERVICE_API_KEY');
    if (!apiKey && isProd) {
      throw new Error('PYTHON_SERVICE_API_KEY environment variable is required in production');
    }
    // In development, use a placeholder if not set (Python service also needs to accept it)
    this.pythonServiceApiKey = apiKey || 'dev-api-key';
  }

  @Post('login/init')
  @ApiOperation({
    summary: 'Initiate Trade Republic login',
    description:
      "Sends a verification code to the user's Trade Republic app. Credentials are never stored.",
  })
  @ApiResponse({ status: 200, description: 'Verification code sent' })
  @ApiResponse({ status: 400, description: 'Invalid phone number or PIN format' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async initLogin(@CurrentUser() user: AuthUser, @Body() dto: TRLoginInitDto) {
    // Validate input format
    if (!/^\+[0-9]{10,15}$/.test(dto.phone_number)) {
      throw new BadRequestException('Invalid phone number format. Must include country code.');
    }
    if (!/^[0-9]{4}$/.test(dto.pin)) {
      throw new BadRequestException('PIN must be exactly 4 digits.');
    }

    this.logger.info({ userId: user.id }, 'Trade Republic login initiated');

    try {
      const response = await fetch(`${this.pythonServiceUrl}/trade-republic/login/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.pythonServiceApiKey,
        },
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new HttpException(data.detail || 'Failed to initiate login', response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error({ error }, 'Failed to proxy Trade Republic login init');
      throw new BadRequestException('Failed to connect to Trade Republic service');
    }
  }

  @Post('login/complete')
  @ApiOperation({
    summary: 'Complete Trade Republic login with verification code',
    description:
      'Submits the 4-digit code and fetches portfolio data. Session is deleted after use.',
  })
  @ApiResponse({ status: 200, description: 'Login completed, data fetched' })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  async completeLogin(@CurrentUser() user: AuthUser, @Body() dto: TRLoginCompleteDto) {
    if (!/^[0-9]{4}$/.test(dto.verify_code)) {
      throw new BadRequestException('Verification code must be exactly 4 digits.');
    }

    this.logger.info({ userId: user.id }, 'Trade Republic login completing');

    try {
      const response = await fetch(`${this.pythonServiceUrl}/trade-republic/login/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.pythonServiceApiKey,
        },
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new HttpException(data.detail || 'Failed to complete login', response.status);
      }

      this.logger.info(
        {
          userId: user.id,
          transactionCount: data.transactions?.length || 0,
          positionCount: data.positions?.length || 0,
        },
        'Trade Republic data fetched successfully',
      );

      return data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error({ error }, 'Failed to proxy Trade Republic login complete');
      throw new BadRequestException('Failed to complete Trade Republic login');
    }
  }

  @Post('login/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend verification code' })
  @ApiResponse({ status: 200, description: 'Code resent' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async resendCode(@CurrentUser() user: AuthUser, @Body() dto: TRResendDto) {
    this.logger.info({ userId: user.id }, 'Trade Republic code resend requested');

    try {
      const url = new URL(`${this.pythonServiceUrl}/trade-republic/login/resend`);
      url.searchParams.set('session_id', dto.session_id);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'X-API-Key': this.pythonServiceApiKey },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new HttpException(data.detail || 'Failed to resend code', response.status);
      }

      return data;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Failed to resend verification code');
    }
  }

  @Delete('session/:sessionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a pending Trade Republic session' })
  @ApiResponse({ status: 200, description: 'Session cancelled' })
  async cancelSession(@CurrentUser() user: AuthUser, @Param('sessionId') sessionId: string) {
    this.logger.info({ userId: user.id }, 'Trade Republic session cancelled');

    try {
      await fetch(`${this.pythonServiceUrl}/trade-republic/session/${sessionId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': this.pythonServiceApiKey },
      });

      return { status: 'cancelled' };
    } catch {
      // Don't throw on cleanup failures
      return { status: 'cancelled' };
    }
  }
}
