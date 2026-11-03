import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Role } from '@repo/types';
import { Auth } from '../common/decorators/auth.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationFilterDto } from './dto/location-filter.dto';

@ApiTags('Locations')
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a location (Company > Unit > Block > Line)',
    description: 'Enforces hierarchy: Company has no parent, Unit belongs to Company, Block belongs to Unit, Line belongs to Block.',
  })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get('tree')
  @ApiOperation({
    summary: 'Get full nested location tree (Company > Unit > Block > Line)',
  })
  findTree() {
    return this.locationsService.findTree();
  }

  @Get()
  @ApiOperation({ summary: 'List locations with filters by level (Company, Unit, Block, Line) and pagination' })
  findAll(@Query() filter: LocationFilterDto) {
    return this.locationsService.findAll(filter);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Lookup location by QR tag or code' })
  findByCode(@Param('code') code: string) {
    return this.locationsService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a location by ID with breadcrumb path (Company > Unit > Block > Line) and asset counts' })
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Put(':id')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Update a location with hierarchy validation' })
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Soft delete / deactivate a location' })
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
