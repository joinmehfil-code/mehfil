import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkillRelation } from '@mehfil/shared';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { UsersService } from './users.service';
import { UpdateProfileDto, SearchUsersQueryDto, UpsertSkillDto } from './dto/user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my full profile' })
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMyProfile(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('me/skills')
  getMySkills(@CurrentUser() user: AuthUser) {
    return this.users.getSkills(user.id);
  }

  @Post('me/skills')
  addSkill(@CurrentUser() user: AuthUser, @Body() dto: UpsertSkillDto) {
    return this.users.upsertSkill(user.id, dto.name, dto.relation as SkillRelation, dto.level);
  }

  @Delete('me/skills')
  removeSkill(@CurrentUser() user: AuthUser, @Body() dto: UpsertSkillDto) {
    return this.users.removeSkill(user.id, dto.name, dto.relation as SkillRelation);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Suggested connections' })
  suggestions(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.users.suggestions(user.id, limit ? parseInt(limit, 10) : 10);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search / discover people' })
  search(
    @CurrentUser() user: AuthUser,
    @Query() query: SearchUsersQueryDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.users.searchUsers(user.id, query, pagination.page, pagination.limit);
  }

  @Get('by-skill')
  @ApiOperation({ summary: 'Find people by a skill they offer' })
  bySkill(
    @CurrentUser() user: AuthUser,
    @Query('skill') skill: string,
    @Query('limit') limit?: string,
  ) {
    return this.users.findPeopleBySkill(user.id, skill || '', limit ? parseInt(limit, 10) : 20);
  }

  // NOTE: ':identifier' route must come after the static routes above.
  @Public()
  @Get(':identifier')
  @ApiOperation({ summary: 'Get a public profile by id or username' })
  getProfile(
    @Param('identifier') identifier: string,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.users.getPublicProfile(user?.id, identifier);
  }

  @Post(':id/follow')
  follow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.follow(user.id, id);
  }

  @Delete(':id/follow')
  unfollow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.unfollow(user.id, id);
  }

  @Post(':id/block')
  block(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.block(user.id, id);
  }

  @Delete(':id/block')
  unblock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.users.unblock(user.id, id);
  }

  @Public()
  @Get(':id/followers')
  followers(@Param('id') id: string, @Query() pagination: PaginationQueryDto) {
    return this.users.listFollowers(id, pagination.page, pagination.limit);
  }

  @Public()
  @Get(':id/following')
  following(@Param('id') id: string, @Query() pagination: PaginationQueryDto) {
    return this.users.listFollowing(id, pagination.page, pagination.limit);
  }
}
