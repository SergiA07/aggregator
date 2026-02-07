import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { OverviewService, type PerformancePeriod } from '../../application/services';

@ApiTags('Overview')
@ApiBearerAuth()
@Controller('overview')
@UseGuards(SupabaseAuthGuard)
export class OverviewController {
  constructor(@Inject(OverviewService) private readonly overviewService: OverviewService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get financial overview summary' })
  @ApiResponse({
    status: 200,
    description: 'Overview summary with net worth, cash, investments, and breakdowns',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getSummary(@CurrentUser() user: AuthUser) {
    return this.overviewService.getSummary(user.id);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Get all accounts with their values' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['1d', '1w', '1m', '3m', 'ytd', '1y', 'all'],
    description: 'Performance period for change calculations (default: ytd)',
  })
  @ApiResponse({ status: 200, description: 'List of accounts with financial summaries' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getAccounts(@CurrentUser() user: AuthUser, @Query('period') period?: PerformancePeriod) {
    return this.overviewService.getAccounts(user.id, period || 'ytd');
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get recent activity (transactions)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of recent transactions to return (default: 10)',
  })
  @ApiResponse({ status: 200, description: 'List of recent transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getRecentActivity(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 10;
    return this.overviewService.getRecentActivity(user.id, Math.min(parsedLimit, 50));
  }
}
