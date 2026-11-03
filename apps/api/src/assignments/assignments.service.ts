import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAssignmentDto, assignedById: string) {
    if (!dto.assignedToUserId && !dto.assignedToDeptId) {
      throw new BadRequestException('Either assignedToUserId or assignedToDeptId must be provided');
    }

    const assignment = await this.prisma.assetAssignment.create({
      data: {
        assetId: dto.assetId,
        assignedToUserId: dto.assignedToUserId,
        assignedToDeptId: dto.assignedToDeptId,
        locationId: dto.locationId,
        assignedById,
        expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : undefined,
        conditionOut: dto.conditionOut,
        notes: dto.notes,
      },
    });

    await this.prisma.asset.update({
      where: { id: dto.assetId },
      data: { status: 'ASSIGNED' },
    });

    return assignment;
  }

  async findByAsset(assetId: string) {
    return this.prisma.assetAssignment.findMany({
      where: { assetId },
      orderBy: { assignedAt: 'desc' },
      include: { assignedToUser: true, assignedToDept: true, assignedBy: true },
    });
  }

  async returnAsset(assignmentId: string, dto: ReturnAssetDto, returnedToId: string) {
    const assignment = await this.prisma.assetAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const updated = await this.prisma.assetAssignment.update({
      where: { id: assignmentId },
      data: {
        returnedAt: new Date(),
        conditionIn: dto.conditionIn,
        notes: dto.notes,
      },
    });

    await this.prisma.asset.update({
      where: { id: assignment.assetId },
      data: { status: 'ACTIVE' },
    });

    return updated;
  }
}
