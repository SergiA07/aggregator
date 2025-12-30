import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type CreateAccountInput,
  createAccountSchema,
  type UpdateAccountInput,
  updateAccountSchema,
} from '@repo/shared-types/schemas';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { ZodValidationPipe } from '@/shared/pipes';
import { assertFound } from '@/shared/utils';
import { AccountsService } from '../../application/services';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all accounts for current user' })
  @ApiResponse({ status: 200, description: 'List of accounts returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async getAccounts(@CurrentUser() user: AuthUser) {
    return this.accountsService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.id, id);
    assertFound(account, 'Account not found');
    return account;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  async createAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput,
  ) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async updateAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountInput,
  ) {
    const account = await this.accountsService.update(user.id, id, dto);
    assertFound(account, 'Account not found');
    return account;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing auth token' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async deleteAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const deleted = await this.accountsService.delete(user.id, id);
    assertFound(deleted, 'Account not found');
    return { message: 'Account deleted' };
  }
}
