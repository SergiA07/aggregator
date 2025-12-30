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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type CreateTransactionInput,
  createTransactionSchema,
  type UpdateTransactionInput,
  updateTransactionSchema,
} from '@repo/shared-types/schemas';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { ZodValidationPipe } from '@/shared/pipes';
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
  @ApiQuery({ name: 'accountId', required: false })
  @ApiQuery({ name: 'securityId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'List of transactions returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
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
  @ApiResponse({ status: 200, description: 'Transaction statistics returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getStats(@CurrentUser() user: AuthUser, @Query('accountId') accountId?: string) {
    return this.transactionsService.getStats(user.id, accountId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const transaction = await this.transactionsService.findOne(user.id, id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
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
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async deleteTransaction(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const deleted = await this.transactionsService.delete(user.id, id);
    if (!deleted) {
      throw new NotFoundException('Transaction not found');
    }
    return { message: 'Transaction deleted' };
  }
}
