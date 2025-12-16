import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth';
import { DatabaseModule } from './database';
import { ImportModule } from './import';
import { PortfolioModule } from './portfolio';

@Module({
  imports: [AuthModule, DatabaseModule, PortfolioModule, ImportModule],
  controllers: [AppController],
})
export class AppModule {}
