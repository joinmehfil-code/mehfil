import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { ReportsService } from './reports.service';
import { CreateReportDto, ResolveReportDto, ReportQueryDto } from './dto/report.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'File a report against a user/content' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.createReport(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List my own reports' })
  mine(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.reports.myReports(user.id, pagination.page, pagination.limit);
  }

  @Get()
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Staff: list all reports' })
  list(@Query() query: ReportQueryDto, @Query() pagination: PaginationQueryDto) {
    return this.reports.listReports(query, pagination.page, pagination.limit);
  }

  @Get(':id')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Staff: fetch a report' })
  get(@Param('id') id: string) {
    return this.reports.getReport(id);
  }

  @Post(':id/resolve')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Staff: resolve a report + apply moderation action' })
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reports.resolveReport(user.id, id, dto);
  }
}
