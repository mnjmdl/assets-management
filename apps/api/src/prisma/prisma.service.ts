import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@repo/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const dbUrl = configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
    super(dbUrl ? { datasources: { db: { url: dbUrl } } } : undefined);
    if (dbUrl) {
      // Obfuscate password in log
      const safeUrl = dbUrl.replace(/password=[^;]+/, 'password=****');
      this.logger.log(`Prisma configured with database: ${safeUrl}`);
    } else {
      this.logger.warn('DATABASE_URL is not defined in environment! Prisma will attempt default resolution.');
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✓ Successfully connected to Microsoft SQL Server');
    } catch (error: any) {
      this.logger.error(
        `⚠️ Could not connect to SQL Server: ${error.message}. Please verify DATABASE_URL and network connectivity to port 1433.`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
