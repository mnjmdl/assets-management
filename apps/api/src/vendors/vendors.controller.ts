import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@repo/types';
import { Auth } from '../common/decorators/auth.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorsService } from './vendors.service';

@ApiTags('Vendors')
@Controller({ path: 'vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get vendor KPIs and counts' })
  getStats() {
    return this.vendorsService.getStats();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.create(createVendorDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all vendors with optional search and filter' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name or code' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.vendorsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single vendor by ID' })
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Put(':id')
  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorsService.update(id, updateVendorDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a vendor' })
  remove(@Param('id') id: string) {
    return this.vendorsService.remove(id);
  }
}
