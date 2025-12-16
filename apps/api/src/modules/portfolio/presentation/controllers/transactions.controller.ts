import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '../../../auth';
import { TransactionsService } from '../../application/services';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(SupabaseAuthGuard)
export class TransactionsController {
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all transactions for current user' })
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'securityId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query('accountId') accountId?: string,
    @Query('securityId') securityId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionsService.findByUser(user.id, {
      accountId,
      securityId,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiQuery({ name: 'accountId', required: false })
  async getStats(@CurrentUser() user: AuthUser, @Query('accountId') accountId?: string) {
    return this.transactionsService.getStats(user.id, accountId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  async getTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const transaction = await this.transactionsService.findOne(user.id, id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  async createTransaction(@CurrentUser() user: AuthUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.id, {
      ...dto,
      date: new Date(dto.date),
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  async updateTransaction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    const transaction = await this.transactionsService.findOne(user.id, id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return this.transactionsService.update(user.id, id, {
      ...dto,
      date: dto.date ? new Date(dto.date) : undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  async deleteTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const transaction = await this.transactionsService.findOne(user.id, id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    await this.transactionsService.delete(user.id, id);
    return { message: 'Transaction deleted' };
  }
}
