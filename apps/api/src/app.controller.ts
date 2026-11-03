import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class AppController {
  @Get()
  @ApiOperation({ summary: 'API health check for mobile reachability' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

