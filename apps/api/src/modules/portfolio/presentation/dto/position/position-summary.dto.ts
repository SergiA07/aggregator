import { ApiProperty } from '@nestjs/swagger';

// Response DTO for position summary (read-only)
export class PositionSummaryDto {
  @ApiProperty({ description: 'Total market value of all positions' })
  totalValue: number;

  @ApiProperty({ description: 'Total cost basis of all positions' })
  totalCost: number;

  @ApiProperty({ description: 'Total unrealized profit/loss' })
  totalPnl: number;

  @ApiProperty({ description: 'Percentage gain/loss' })
  pnlPercentage: number;

  @ApiProperty({ description: 'Number of positions' })
  positionCount: number;
}
