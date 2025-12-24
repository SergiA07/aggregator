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
import {
  type CreateSecurityInput,
  createSecuritySchema,
  type UpdateSecurityInput,
  updateSecuritySchema,
} from '@repo/shared-types/schemas';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
import { ZodValidationPipe } from '@/shared/pipes';
import { SecuritiesService } from '../../application/services';

@ApiTags('Securities')
@ApiBearerAuth()
@Controller('securities')
@UseGuards(SupabaseAuthGuard)
export class SecuritiesController {
  constructor(@Inject(SecuritiesService) private readonly securitiesService: SecuritiesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all securities' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by symbol, name, or ISIN' })
  async getSecurities(@Query('search') search?: string) {
    return this.securitiesService.findAll(search);
  }

  @Get('my-holdings')
  @ApiOperation({ summary: 'Get securities that user has positions in' })
  async getMySecurities(@CurrentUser() user: AuthUser) {
    return this.securitiesService.getSecuritiesWithPositions(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get security by ID' })
  async getSecurity(@Param('id') id: string) {
    const security = await this.securitiesService.findOne(id);
    if (!security) {
      throw new NotFoundException('Security not found');
    }
    return security;
  }

  @Get('isin/:isin')
  @ApiOperation({ summary: 'Get security by ISIN' })
  async getSecurityByIsin(@Param('isin') isin: string) {
    const security = await this.securitiesService.findByIsin(isin);
    if (!security) {
      throw new NotFoundException('Security not found');
    }
    return security;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new security' })
  async createSecurity(
    @Body(new ZodValidationPipe(createSecuritySchema)) dto: CreateSecurityInput,
  ) {
    return this.securitiesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a security' })
  async updateSecurity(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSecuritySchema)) dto: UpdateSecurityInput,
  ) {
    const security = await this.securitiesService.update(id, dto);
    if (!security) {
      throw new NotFoundException('Security not found');
    }
    return security;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a security' })
  async deleteSecurity(@Param('id') id: string) {
    const deleted = await this.securitiesService.delete(id);
    if (!deleted) {
      throw new NotFoundException('Security not found');
    }
    return { message: 'Security deleted' };
  }
}
