import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators';
import { AdminService } from './admin.service';
import {
  AdminUserQueryDto,
  RangeQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';

@ApiTags('admin')
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard aggregate metrics' })
  stats() {
    return this.admin.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List/search users' })
  users(@Query() query: AdminUserQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get a single user (admin view)' })
  user(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Suspend/ban/activate a user' })
  setStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.admin.setUserStatus(id, dto.status);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Change a user role' })
  setRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.admin.setUserRole(id, dto.role);
  }

  @Get('analytics/users')
  @ApiOperation({ summary: 'Daily signup growth' })
  userGrowth(@Query() query: RangeQueryDto) {
    return this.admin.userGrowth(query.days);
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Daily paid revenue' })
  revenue(@Query() query: RangeQueryDto) {
    return this.admin.revenueGrowth(query.days);
  }
}
