import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from 'src/decorators';
import RequiresVerification from 'src/decorators/RequiresVerification';
import { Auth, Admin } from 'src/guards';
import type { User as UserType } from 'src/types';
import { CreateUserDTO, UpdateUserDTO } from './dto';
import AdminService from './service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(Auth, Admin)
@RequiresVerification(true)
export default class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers({ page, limit, search });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.getUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('users')
  @ApiOperation({ summary: 'Create new user' })
  @ApiBody({ type: CreateUserDTO })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async createUser(@Body() dto: CreateUserDTO) {
    return this.adminService.createUser(dto);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDTO })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async updateUser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDTO,
  ) {
    const user = await this.adminService.updateUser(id, dto);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async deleteUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const deleted = await this.adminService.deleteUser(id);
    if (!deleted) throw new NotFoundException('User not found');
  }

  @Post('users/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User verified successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async verifyUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.verifyUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async banUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.banUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('users/:id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unban user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async unbanUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.unbanUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('users/:id/promote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promote user to admin' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User promoted to admin successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async promoteUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.promoteUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Post('users/:id/demote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demote user from admin' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User demoted from admin successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async demoteUser(@Param('id', new ParseUUIDPipe()) id: string) {
    const user = await this.adminService.demoteUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
