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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type CreateAccountInput,
  createAccountSchema,
  type UpdateAccountInput,
  updateAccountSchema,
} from '@repo/shared-types/schemas';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { ZodValidationPipe } from '@/shared/pipes';
import { AccountsService } from '../../application/services';

@ApiTags('Accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all accounts for current user' })
  async getAccounts(@CurrentUser() user: AuthUser) {
    return this.accountsService.findByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  async getAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new account' })
  async createAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput,
  ) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an account' })
  async updateAccount(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountInput,
  ) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an account' })
  async deleteAccount(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const account = await this.accountsService.findOne(user.id, id);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    await this.accountsService.delete(user.id, id);
    return { message: 'Account deleted' };
  }
}
