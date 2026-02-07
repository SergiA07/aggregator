import { Module } from '@nestjs/common';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { OverviewService } from './application/services';
import { OverviewController } from './presentation/controllers';

@Module({
  imports: [PortfolioModule],
  controllers: [OverviewController],
  providers: [OverviewService],
  exports: [OverviewService],
})
export class OverviewModule {}
