import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PositionsController } from './positions.controller';
import { PositionsService } from './positions.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { SecuritiesController } from './securities.controller';
import { SecuritiesService } from './securities.service';
import { DatabaseModule } from '../database';
import { AuthModule } from '../auth';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    AccountsController,
    PositionsController,
    TransactionsController,
    SecuritiesController,
  ],
  providers: [
    AccountsService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
  ],
  exports: [
    AccountsService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
  ],
})
export class PortfolioModule {}
