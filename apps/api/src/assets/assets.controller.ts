import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Res, UseInterceptors, UploadedFiles, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { AssetFilterDto } from './dto/asset-filter.dto';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@repo/types';

@ApiTags('Assets')
@Controller({ path: 'assets', version: '1' })
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Create a new asset' })
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: any) {
    return this.assetsService.create(dto, user?.id);
  }

  @Post('preview-excel')
  @ApiOperation({ summary: 'Preview Excel file and compare with existing asset codes before insertion' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  previewExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Excel file (.xlsx) is required');
    }
    return this.assetsService.previewExcel(file.buffer, user?.id);
  }

  @Post('upload-excel')
  @ApiOperation({ summary: 'Bulk import assets from Excel (.xlsx)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Excel file (.xlsx) is required');
    }
    return this.assetsService.importExcel(file.buffer, user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all assets with filters and pagination' })
  findAll(@Query() filter: AssetFilterDto) {
    return this.assetsService.findAll(filter);
  }

  @Get('export-excel')
  @ApiOperation({ summary: 'Export assets to Excel (.xlsx)' })
  async exportExcel(@Query() filter: AssetFilterDto, @Res() res: any) {
    const buffer = await this.assetsService.exportExcel(filter);
    const filename = `Assets-Inventory-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Get('scan/:code')
  @ApiOperation({ summary: 'Find asset by QR code or asset code (for audit scanning)' })
  findByCode(@Param('code') code: string) {
    return this.assetsService.findByCode(code);
  }

  @Get('reference-options')
  @ApiOperation({ summary: 'Get reference options for asset forms (categories, locations, departments, vendors)' })
  getReferenceOptions() {
    return this.assetsService.getReferenceOptions();
  }

  @Get('offline-sync')
  @ApiOperation({ summary: 'Get lightweight asset records for offline PWA synchronization' })
  getOfflineSyncAssets(@Query('updatedSince') updatedSince?: string) {
    return this.assetsService.getOfflineSyncAssets(updatedSince);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Put(':id')
  @Patch(':id')
  @ApiOperation({ summary: 'Update asset details' })
  update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @CurrentUser() user: any) {
    return this.assetsService.update(id, dto, user?.id);
  }

  @Patch(':id/status')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Update asset status' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAssetStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.updateStatus(id, dto, user.id);
  }

  @Get(':id/depreciation')
  @ApiOperation({ summary: 'Calculate and update current depreciation value' })
  calculateDepreciation(@Param('id') id: string) {
    return this.assetsService.calculateDepreciation(id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Generate QR code for asset' })
  generateQR(@Param('id') id: string) {
    return this.assetsService.generateQR(id);
  }

  @Post(':id/photos')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Upload asset photos' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('photos', 10))
  addPhotos(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.assetsService.addPhotos(id, files);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Soft-delete an asset' })
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
