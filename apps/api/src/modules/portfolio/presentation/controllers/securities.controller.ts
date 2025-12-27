import {
  BadRequestException,
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
import { AdminGuard, type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';
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
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by symbol, name, or ISIN (max 100 chars)',
  })
  async getSecurities(@Query('search') search?: string) {
    if (search && search.length > 100) {
      throw new BadRequestException('Search query too long (max 100 characters)');
    }
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
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new security (admin only)' })
  async createSecurity(
    @Body(new ZodValidationPipe(createSecuritySchema)) dto: CreateSecurityInput,
  ) {
    return this.securitiesService.create(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update a security (admin only)' })
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
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete a security (admin only)' })
  async deleteSecurity(@Param('id') id: string) {
    const deleted = await this.securitiesService.delete(id);
    if (!deleted) {
      throw new NotFoundException('Security not found');
    }
    return { message: 'Security deleted' };
  }
}
