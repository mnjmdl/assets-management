import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  ForbiddenException,
  ParseBoolPipe,
  ParseIntPipe,
  Optional,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@repo/types';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Auth } from '../common/decorators/auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List all users with optional filters and pagination' })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.usersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      role,
      departmentId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get a single user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Auth(Role.SUPER_ADMIN, Role.ASSET_MANAGER)
  @ApiOperation({ summary: 'Update a user (SUPER_ADMIN, ASSET_MANAGER)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/password')
  @Auth()
  @ApiOperation({ summary: 'Change own password' })
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: any,
  ) {
    if (currentUser.id !== id) {
      throw new ForbiddenException('You can only change your own password');
    }
    return this.usersService.changePassword(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete (deactivate) a user (SUPER_ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/avatar')
  @Auth()
  @ApiOperation({ summary: 'Upload avatar for a user' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(id, file);
  }
}
