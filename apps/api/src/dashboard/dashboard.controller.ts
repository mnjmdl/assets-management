import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get operational KPIs and asset breakdown' })
  getKPIs(@CurrentUser() user: any) {
    return this.dashboardService.getKPIs(user?.id || 'admin', user?.role || 'SUPER_ADMIN');
  }
}
