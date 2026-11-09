import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LocationsModule } from './locations/locations.module';
import { AssetsModule } from './assets/assets.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TransfersModule } from './transfers/transfers.module';
import { VendorsModule } from './vendors/vendors.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { AuditsModule } from './audits/audits.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SettingsModule } from './settings/settings.module';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  imports: [
    // Config (reads .env from local and parent monorepo directories)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env', '../../.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    LocationsModule,
    AssetsModule,
    AssignmentsModule,
    TransfersModule,
    VendorsModule,
    MaintenanceModule,
    AuditsModule,
    ReportsModule,
    NotificationsModule,
    DashboardModule,
    SettingsModule,
  ],
})
export class AppModule {}
