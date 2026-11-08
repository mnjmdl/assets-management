import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuditsService } from './audits.service';
import { CreateAuditPlanDto } from './dto/create-audit-plan.dto';
import { CreateAuditSessionDto } from './dto/create-audit-session.dto';
import { SubmitAuditItemDto } from './dto/submit-audit-item.dto';
import { QuickScanDto } from './dto/quick-scan.dto';
import { ResolveDiscrepancyDto } from './dto/resolve-discrepancy.dto';
import { CommitLocationBatchDto } from './dto/commit-location-batch.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Audits')
@Controller({ path: 'audits', version: '1' })
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post('quick-scan')
  @ApiOperation({ summary: 'Quick scan / offline outbox sync endpoint for terminal tag verification' })
  quickScan(@Body() dto: QuickScanDto, @CurrentUser() user: any) {
    return this.auditsService.quickScan(dto, user?.id || 'admin');
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create an audit plan' })
  createPlan(@Body() dto: CreateAuditPlanDto, @CurrentUser() user: any) {
    return this.auditsService.createPlan(dto, user?.id || 'admin');
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all audit plans' })
  findAllPlans(@Query() query: any) {
    return this.auditsService.findAllPlans(query);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get audit plan details' })
  findOnePlan(@Param('id') id: string) {
    return this.auditsService.findOnePlan(id);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Delete an audit plan' })
  deletePlan(@Param('id') id: string) {
    return this.auditsService.deletePlan(id);
  }

  @Put('plans/:id/publish')
  @ApiOperation({ summary: 'Publish an audit plan' })
  publishPlan(@Param('id') id: string) {
    return this.auditsService.publishPlan(id);
  }

  @Post('plans/:id/commit-location')
  @ApiOperation({ summary: 'Commit batch of scanned assets for a location under an audit plan' })
  commitLocationBatch(
    @Param('id') planId: string,
    @Body() dto: CommitLocationBatchDto,
    @CurrentUser() user: any,
  ) {
    return this.auditsService.commitLocationBatch(planId, dto, user?.id || 'admin');
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create an audit session' })
  createSession(@Body() dto: CreateAuditSessionDto) {
    return this.auditsService.createSession(dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all audit sessions' })
  findAllSessions(@Query() query: any) {
    return this.auditsService.findAllSessions(query);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get audit session details' })
  findOneSession(@Param('id') id: string) {
    return this.auditsService.findOneSession(id);
  }

  @Put('sessions/:id/complete')
  @ApiOperation({ summary: 'Mark an audit session as complete' })
  completeSession(
    @Param('id') id: string,
    @Body() body: { markUnscannedAsMissing?: boolean },
    @CurrentUser() user: any,
  ) {
    return this.auditsService.completeSession(id, user?.id || 'admin', Boolean(body?.markUnscannedAsMissing));
  }

  @Put('sessions/:id/mark-unscanned-missing')
  @ApiOperation({ summary: 'Mark all pending unscanned items in a session as missing' })
  markSessionUnscannedMissing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.auditsService.markUnscannedItemsAsMissing(id, user?.id || 'admin');
  }

  @Put('plans/:id/mark-unscanned-missing')
  @ApiOperation({ summary: 'Mark all pending unscanned items in an audit plan as missing' })
  markPlanUnscannedMissing(@Param('id') id: string, @CurrentUser() user: any) {
    return this.auditsService.markPlanUnscannedAsMissing(id, user?.id || 'admin');
  }

  @Put('sessions/:sessionId/items/:itemId/mark-missing')
  @ApiOperation({ summary: 'Mark a single audit item as missing' })
  markItemMissing(
    @Param('itemId') itemId: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.auditsService.markItemMissing(itemId, user?.id || 'admin', body?.notes);
  }

  @Put('discrepancies/:id/approve-lost')
  @ApiOperation({ summary: 'Manager approval: confirm missing asset and mark as LOST in master registry' })
  approveMissingAsLost(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.auditsService.resolveDiscrepancy(
      id,
      {
        resolutionNotes: body?.notes || 'Confirmed missing & marked as LOST by manager',
        action: 'MARK_LOST',
        markAssetAsLost: true,
      },
      user?.id || 'admin',
    );
  }

  @Put('sessions/:id/reopen')
  @ApiOperation({ summary: 'Reopen a completed audit session' })
  reopenSession(@Param('id') id: string) {
    return this.auditsService.reopenSession(id);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete an audit session' })
  deleteSession(@Param('id') id: string) {
    return this.auditsService.deleteSession(id);
  }

  @Get('sessions/:id/items')
  @ApiOperation({ summary: 'Get audit session items' })
  findSessionItems(@Param('id') id: string) {
    return this.auditsService.findSessionItems(id);
  }

  @Post('sessions/:id/items')
  @ApiOperation({ summary: 'Submit audit item scan' })
  submitItem(
    @Param('id') id: string,
    @Body() dto: SubmitAuditItemDto,
    @CurrentUser() user: any,
  ) {
    return this.auditsService.submitAuditItem(id, dto, user?.id || 'admin');
  }

  @Put('discrepancies/:id/resolve')
  @ApiOperation({ summary: 'Resolve discrepancy' })
  resolveDiscrepancy(@Param('id') id: string, @Body() dto: ResolveDiscrepancyDto, @CurrentUser() user: any) {
    return this.auditsService.resolveDiscrepancy(id, dto, user?.id || 'admin');
  }
}
