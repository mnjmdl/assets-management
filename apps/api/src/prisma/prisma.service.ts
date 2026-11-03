import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@repo/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✓ Successfully connected to Microsoft SQL Server');
    } catch (error: any) {
      this.logger.error(
        `⚠️ Could not connect to SQL Server at localhost:1433: ${error.message}. Server is running, but database operations will fail until SQL Server is started.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
