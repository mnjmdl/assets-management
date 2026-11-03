import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Patch,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateUserDto, UpdateUserStatusDto } from './dto/create-user.dto';

@ApiTags('Settings')
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ─── System Settings ────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Retrieve all system configuration settings' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: 'Update system configuration settings' })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto.settings);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system stats, database health and table metrics' })
  getStats() {
    return this.settingsService.getStats();
  }

  // ─── Category Management ──────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List all asset categories with asset counts' })
  getCategories() {
    return this.settingsService.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new asset category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.settingsService.createCategory(dto);
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update an asset category' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.settingsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete an asset category (if no assets are assigned)' })
  deleteCategory(@Param('id') id: string) {
    return this.settingsService.deleteCategory(id);
  }

  // ─── User Management ───────────────────────────────────────────────────────

  @Get('users')
  @ApiOperation({ summary: 'List all users with roles and status' })
  getUsers() {
    return this.settingsService.getUsers();
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new system user' })
  createUser(@Body() dto: CreateUserDto) {
    return this.settingsService.createUser(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user profile, role, or active status' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.settingsService.updateUser(id, dto);
  }
}

