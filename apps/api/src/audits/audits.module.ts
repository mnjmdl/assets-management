import { Module } from '@nestjs/common';
import { AuditsController } from './audits.controller';
import { AuditsService } from './audits.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditsController],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}
