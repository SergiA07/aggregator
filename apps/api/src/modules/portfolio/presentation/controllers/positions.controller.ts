import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';
import { PositionsService } from '../../application/services';

@ApiTags('Positions')
@ApiBearerAuth()
@Controller('positions')
@UseGuards(SupabaseAuthGuard)
export class PositionsController {
  constructor(@Inject(PositionsService) private readonly positionsService: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all positions for current user' })
  async getPositions(@CurrentUser() user: AuthUser) {
    return this.positionsService.findByUser(user.id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get portfolio summary' })
  async getSummary(@CurrentUser() user: AuthUser) {
    return this.positionsService.getSummary(user.id);
  }

  @Get('account/:accountId')
  @ApiOperation({ summary: 'Get positions by account' })
  async getPositionsByAccount(
    @CurrentUser() user: AuthUser,
    @Param('accountId') accountId: string,
  ) {
    return this.positionsService.findByAccount(user.id, accountId);
  }
}
