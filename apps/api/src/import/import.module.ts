import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { DatabaseModule } from '../database';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
