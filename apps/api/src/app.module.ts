import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth';
import { PortfolioModule } from './modules/portfolio';
import { DatabaseModule } from './shared/database';

@Module({
  imports: [DatabaseModule, AuthModule, PortfolioModule],
  controllers: [AppController],
})
export class AppModule {}
