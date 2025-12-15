import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard, CurrentUser } from '../auth';
import { AccountsService } from './accounts.service';

class CreateAccountDto {
  broker: string;
  accountId: string;
  accountName?: string;
  currency?: string;
}

class UpdateAccountDto {
  accountName?: string;
  currency?: string;
}

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all accounts for current user' })
  async getAccounts(@CurrentUser() user: User) {
    return this.accountsService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  async getAccount(@CurrentUser() user: User, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  async createAccount(@CurrentUser() user: User, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  async updateAccount(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  async deleteAccount(@CurrentUser() user: User, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    await this.accountsService.delete(user.id, id);
    return { message: 'Account deleted' };
  }
}
