import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';
import { PositionsService } from '../../application/services';
import { PositionSummaryDto } from '../dto';

@ApiTags('Positions')
@ApiBearerAuth()
@Controller('positions')
@UseGuards(SupabaseAuthGuard)
export class PositionsController {
  constructor(@Inject(PositionsService) private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all positions for current user' })
  @ApiResponse({ status: 200, description: 'List of positions returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getPositions(@CurrentUser() user: AuthUser) {
    return this.positionsService.findByUser(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary' })
  @ApiResponse({ status: 200, description: 'Portfolio summary', type: PositionSummaryDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getSummary(@CurrentUser() user: AuthUser) {
    return this.positionsService.getSummary(user.id);
  }

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Get positions by account' })
  @ApiResponse({ status: 200, description: 'List of positions for the account' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getPositionsByAccount(
    @CurrentUser() user: AuthUser,
    @Param('accountId') accountId: string,
  ) {
    return this.positionsService.findByAccount(user.id, accountId);
  }
}
