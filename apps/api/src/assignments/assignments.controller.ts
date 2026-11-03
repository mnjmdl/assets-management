import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Assignments')
@Controller({ path: 'assignments', version: '1' })
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Assign an asset to a user or department' })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id || 'admin');
  }

  @Get('asset/:assetId')
  @ApiOperation({ summary: 'Get assignments history for an asset' })
  findByAsset(@Param('assetId') assetId: string) {
    return this.service.findByAsset(assetId);
  }

  @Patch(':id/return')
  @ApiOperation({ summary: 'Return an assigned asset' })
  returnAsset(
    @Param('id') id: string,
    @Body() dto: ReturnAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.service.returnAsset(id, dto, user?.id || 'admin');
  }
}

