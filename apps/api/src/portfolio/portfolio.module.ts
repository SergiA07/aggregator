import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { DatabaseModule } from '../database';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { SecuritiesController } from './securities.controller';
import { SecuritiesService } from './securities.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    AccountsController,
    PositionsController,
    TransactionsController,
    SecuritiesController,
  ],
  providers: [AccountsService, PositionsService, TransactionsService, SecuritiesService],
  exports: [AccountsService, PositionsService, TransactionsService, SecuritiesService],
})
export class PortfolioModule {}
