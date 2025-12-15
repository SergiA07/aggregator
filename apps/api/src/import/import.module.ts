import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { DatabaseModule } from '../database';
import { AuthModule } from '../auth';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
