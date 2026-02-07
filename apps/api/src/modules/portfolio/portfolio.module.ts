import { Module } from '@nestjs/common';
import { DatabaseService } from '../../shared/database';
import {
  DegiroParser,
  IbkrParser,
  SabadellParser,
  TradeRepublicParser,
} from './application/parsers';
import {
  AccountsService,
  CostBasisService,
  LotService,
  PositionsService,
  PriceUpdateService,
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
import {
  FinnhubService,
  JustEtfService,
  OpenFigiService,
  YahooFinanceService,
} from './infrastructure/services';
import {
  AccountsController,
  ImportController,
  PositionsController,
  PricesController,
  SecuritiesController,
  TradeRepublicController,
  TransactionsController,
} from './presentation/controllers';

@Module({
  controllers: [
    AccountsController,
    PositionsController,
    PricesController,
    TransactionsController,
    SecuritiesController,
    ImportController,
    TradeRepublicController,
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
    CostBasisService,
    LotService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
    OpenFigiService,
    FinnhubService,
    YahooFinanceService,
    JustEtfService,
    PriceUpdateService,

    // Parsers (injectable with logging)
    DegiroParser,
    IbkrParser,
    SabadellParser,
    TradeRepublicParser,
    {
      provide: CSV_PARSERS,
      useFactory: (
        degiro: DegiroParser,
        ibkr: IbkrParser,
        sabadell: SabadellParser,
        tradeRepublic: TradeRepublicParser,
      ) => [degiro, ibkr, sabadell, tradeRepublic],
      inject: [DegiroParser, IbkrParser, SabadellParser, TradeRepublicParser],
    },

    // Use cases
    ImportTransactionsUseCase,
  ],
  exports: [
    AccountsService,
    CostBasisService,
    LotService,
    PositionsService,
    TransactionsService,
    SecuritiesService,
    PriceUpdateService,
    YahooFinanceService,
    ImportTransactionsUseCase,
  ],
})
export class PortfolioModule {}
