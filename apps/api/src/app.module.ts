import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth';
import { DatabaseModule } from './database';
import { PortfolioModule } from './portfolio';
import { ImportModule } from './import';

@Module({
  imports: [AuthModule, DatabaseModule, PortfolioModule, ImportModule],
  controllers: [AppController],
})
export class AppModule {}
