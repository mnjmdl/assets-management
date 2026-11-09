import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { bcrypt } from '../common/utils/bcrypt.util';
import { Prisma } from '@repo/database';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface FindAllUsersFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  departmentId?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FindAllUsersFilter) {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      departmentId,
      isActive,
    } = filter;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { employeeId: { contains: search } },
      ];
    }

    if (role) {
      where.role = role as any;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          phone: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          departmentId: true,
          department: {
            select: { id: true, name: true },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        departmentId: true,
        department: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existingUser = await this.findOne(id);

    if (dto.email && dto.email.toLowerCase().trim() !== existingUser.email.toLowerCase().trim()) {
      const emailNormalized = dto.email.toLowerCase().trim();
      const existing = await this.prisma.user.findUnique({
        where: { email: emailNormalized },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`User with email "${dto.email}" already exists`);
      }
    }

    let passwordHash: string | undefined;
    if (dto.password && dto.password.trim().length > 0) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email.toLowerCase().trim() }),
        ...(passwordHash ? { passwordHash } : {}),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        departmentId: true,
        department: {
          select: { id: true, name: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('newPassword and confirmPassword do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: newHash },
    });

    return { message: 'Password updated successfully' };
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: `User "${id}" deactivated successfully` };
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    await this.findOne(id);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { avatarUrl: file.path },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    return updated;
  }
}
