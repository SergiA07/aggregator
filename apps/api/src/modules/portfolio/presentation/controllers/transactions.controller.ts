import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type CreateTransactionInput,
  createTransactionSchema,
  type TransactionFiltersInput,
  transactionFiltersSchema,
  type UpdateTransactionInput,
  updateTransactionSchema,
} from '@repo/shared-types/schemas';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { ZodValidationPipe } from '@/shared/pipes';
import { assertFound } from '@/shared/utils';
import { TransactionsService } from '../../application/services';

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
  @ApiQuery({ name: 'accountId', required: false, description: 'Filter by account UUID' })
  @ApiQuery({ name: 'securityId', required: false, description: 'Filter by security UUID' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['buy', 'sell', 'dividend', 'fee', 'split', 'other'],
    description: 'Filter by transaction type',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2024-01-01',
    description: 'Start date (YYYY-MM-DD format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2024-12-31',
    description: 'End date (YYYY-MM-DD format)',
  })
  @ApiResponse({ status: 200, description: 'List of transactions returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getTransactions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(transactionFiltersSchema)) filters: TransactionFiltersInput,
  ) {
    return this.transactionsService.findByUser(user.id, {
      ...filters,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Filter by account UUID' })
  @ApiResponse({ status: 200, description: 'Transaction statistics returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getStats(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(transactionFiltersSchema.pick({ accountId: true })))
    filters: Pick<TransactionFiltersInput, 'accountId'>,
  ) {
    return this.transactionsService.getStats(user.id, filters.accountId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const transaction = await this.transactionsService.findOne(user.id, id);
    assertFound(transaction, 'Transaction not found');
    return transaction;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async createTransaction(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createTransactionSchema)) dto: CreateTransactionInput,
  ) {
    return this.transactionsService.create(user.id, {
      ...dto,
      date: new Date(dto.date),
    });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async updateTransaction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) dto: UpdateTransactionInput,
  ) {
    const transaction = await this.transactionsService.update(user.id, id, {
      ...dto,
      date: dto.date ? new Date(dto.date) : undefined,
    });
    assertFound(transaction, 'Transaction not found');
    return transaction;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const deleted = await this.transactionsService.delete(user.id, id);
    assertFound(deleted, 'Transaction not found');
    return { message: 'Transaction deleted' };
  }
}
