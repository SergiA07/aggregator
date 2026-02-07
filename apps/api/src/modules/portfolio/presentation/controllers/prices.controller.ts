import { Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { PriceUpdateService } from '../../application/services';
import { FinnhubService, YahooFinanceService } from '../../infrastructure/services';

@ApiTags('Prices')
@ApiBearerAuth()
@Controller('prices')
@UseGuards(SupabaseAuthGuard)
export class PricesController {
  constructor(
    @Inject(PriceUpdateService) private readonly priceUpdateService: PriceUpdateService,
    @Inject(FinnhubService) private readonly finnhub: FinnhubService,
    @Inject(YahooFinanceService) private readonly yahooFinance: YahooFinanceService,
  ) {}

  @Post('update')
  @ApiOperation({ summary: 'Update market prices for all user positions' })
  @ApiResponse({ status: 200, description: 'Prices updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePrices(@CurrentUser() user: AuthUser) {
    const result = await this.priceUpdateService.updateUserPositions(user.id);

    // Count sources for summary
    const sourceCounts = Object.values(result.sources).reduce(
      (acc, source) => {
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      success: true,
      updated: result.updated,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      sources: sourceCounts,
    };
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get positions with current market prices' })
  @ApiResponse({ status: 200, description: 'Positions with prices returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPositionsWithPrices(@CurrentUser() user: AuthUser) {
    return this.priceUpdateService.getPositionsWithPrices(user.id);
  }

  @Get('quote/:symbol')
  @ApiOperation({ summary: 'Get current quote for a symbol (tries Finnhub first, then Yahoo)' })
  @ApiResponse({ status: 200, description: 'Quote returned' })
  @ApiResponse({ status: 404, description: 'Symbol not found' })
  async getQuote(@Param('symbol') symbol: string) {
    // Try Finnhub first for US symbols (no exchange suffix)
    const isUsSymbol = !symbol.includes('.') && !symbol.includes(':');
    if (isUsSymbol && this.finnhub.isAvailable()) {
      const finnhubQuote = await this.finnhub.getQuote(symbol);
      if (finnhubQuote) {
        return { ...finnhubQuote, source: 'finnhub' };
      }
    }

    // Fallback to Yahoo Finance
    const yahooQuote = await this.yahooFinance.getQuote(symbol);
    if (yahooQuote) {
      return { ...yahooQuote, source: 'yahoo' };
    }

    return { error: 'Symbol not found', symbol };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for a security symbol' })
  @ApiQuery({ name: 'q', description: 'Search query (company name, ticker, or ISIN)' })
  @ApiResponse({ status: 200, description: 'Search results returned' })
  async searchSymbol(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return [];
    }
    return this.yahooFinance.searchSymbol(query);
  }

  @Get('history/:symbol')
  @ApiOperation({ summary: 'Get historical prices for a symbol' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days of history (default 365)',
  })
  @ApiResponse({ status: 200, description: 'Historical prices returned' })
  async getHistory(@Param('symbol') symbol: string, @Query('days') days?: string) {
    const numDays = days ? Number.parseInt(days, 10) : 365;
    const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000);

    return this.yahooFinance.getHistoricalPrices(symbol, { startDate });
  }
}
