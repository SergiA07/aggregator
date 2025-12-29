import { Module } from '@nestjs/common';
import { DatabaseService } from '../../shared/database';
import { DegiroParser, TradeRepublicParser } from './application/parsers';
import {
  AccountsService,
  PositionsService,
  SecuritiesService,
  TransactionsService,
} from './application/services';
import { CSV_PARSERS, ImportTransactionsUseCase } from './application/use-cases';
import {
  ACCOUNT_REPOSITORY,
  AccountRepository,
  POSITION_REPOSITORY,
  PositionRepository,
  SECURITY_REPOSITORY,
  SecurityRepository,
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from './infrastructure/repositories';
import { OpenFigiService } from './infrastructure/services';
import {
  AccountsController,
  ImportController,
  PositionsController,
  SecuritiesController,
  TransactionsController,
} from './presentation/controllers';

@Module({
  controllers: [
    AccountsController,
    PositionsController,
    TransactionsController,
    SecuritiesController,
    ImportController,
  ],
  providers: [
    // Repository bindings using factory providers for proper DI
    {
      provide: ACCOUNT_REPOSITORY,
      useFactory: (db: DatabaseService) => new AccountRepository(db),
      inject: [DatabaseService],
    },
    {
      provide: POSITION_REPOSITORY,
      useFactory: (db: DatabaseService) => new PositionRepository(db),
      inject: [DatabaseService],
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useFactory: (db: DatabaseService) => new TransactionRepository(db),
      inject: [DatabaseService],
    },
    {
      provide: SECURITY_REPOSITORY,
      useFactory: (db: DatabaseService) => new SecurityRepository(db),
      inject: [DatabaseService],
    },

    // Services
    AccountsService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
    OpenFigiService,

    // Parsers (injectable with logging)
    DegiroParser,
    TradeRepublicParser,
    {
      provide: CSV_PARSERS,
      useFactory: (degiro: DegiroParser, tradeRepublic: TradeRepublicParser) => [
        degiro,
        tradeRepublic,
      ],
      inject: [DegiroParser, TradeRepublicParser],
    },

    // Use cases
    ImportTransactionsUseCase,
  ],
  exports: [
    AccountsService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
    ImportTransactionsUseCase,
  ],
})
export class PortfolioModule {}
