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
import { CommunityMemberStatus } from '@mehfil/shared';
import { CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CommunitiesService } from './communities.service';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateSpaceDto,
  UpdateSpaceDto,
  UpdateMemberRoleDto,
  UpdateMemberStatusDto,
  InviteMembersDto,
  CommunityQueryDto,
} from './dto/community.dto';

@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communities: CommunitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a community' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommunityDto) {
    return this.communities.createCommunity(user.id, dto);
  }

  @Get('discover')
  @Public()
  @ApiOperation({ summary: 'Discover / search communities' })
  discover(
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: CommunityQueryDto,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.communities.discover(user?.id, query, pagination.page, pagination.limit);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Communities I belong to' })
  mine(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.communities.myCommunities(user.id, pagination.page, pagination.limit);
  }

  @Post('invites/:token/accept')
  @ApiOperation({ summary: 'Accept a community invite by token' })
  acceptInvite(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.communities.acceptInvite(user.id, token);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a community by id or slug' })
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.communities.getCommunity(user?.id, user?.role, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a community (admins+)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communities.updateCommunity(user.id, user.role, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a community (owner/staff)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.communities.deleteCommunity(user.id, user.role, id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community or request to join' })
  join(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.communities.join(user.id, id);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a community' })
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.communities.leave(user.id, id);
  }

  // -------------------------------- Members --------------------------------

  @Get(':id/members')
  @Public()
  @ApiOperation({ summary: 'List community members' })
  members(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.communities.listMembers(user?.id, user?.role, id, pagination.page, pagination.limit);
  }

  @Get(':id/requests')
  @ApiOperation({ summary: 'List pending join requests (moderators+)' })
  requests(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.communities.pendingRequests(user.id, user.role, id, pagination.page, pagination.limit);
  }

  @Post(':id/requests/:memberId/approve')
  @ApiOperation({ summary: 'Approve a join request (moderators+)' })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.communities.reviewRequest(user.id, user.role, id, memberId, true);
  }

  @Post(':id/requests/:memberId/reject')
  @ApiOperation({ summary: 'Reject a join request (moderators+)' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.communities.reviewRequest(user.id, user.role, id, memberId, false);
  }

  @Put(':id/members/:userId/role')
  @ApiOperation({ summary: 'Change a member role (admins+)' })
  setRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.communities.updateMemberRole(user.id, user.role, id, userId, dto.role);
  }

  @Put(':id/members/:userId/status')
  @ApiOperation({ summary: 'Mute/suspend/ban a member (moderators+)' })
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    return this.communities.updateMemberStatus(
      user.id,
      user.role,
      id,
      userId,
      dto.status as CommunityMemberStatus,
    );
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member (moderators+, or self)' })
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.communities.removeMember(user.id, user.role, id, userId);
  }

  // --------------------------------- Spaces --------------------------------

  @Get(':id/spaces')
  @Public()
  @ApiOperation({ summary: 'List spaces in a community' })
  spaces(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.communities.listSpaces(user?.id, user?.role, id);
  }

  @Post(':id/spaces')
  @ApiOperation({ summary: 'Create a space (admins+)' })
  createSpace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.communities.createSpace(user.id, user.role, id, dto);
  }

  @Put(':id/spaces/:spaceId')
  @ApiOperation({ summary: 'Update a space (admins+)' })
  updateSpace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('spaceId') spaceId: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.communities.updateSpace(user.id, user.role, id, spaceId, dto);
  }

  @Delete(':id/spaces/:spaceId')
  @ApiOperation({ summary: 'Delete a space (admins+)' })
  deleteSpace(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('spaceId') spaceId: string,
  ) {
    return this.communities.deleteSpace(user.id, user.role, id, spaceId);
  }

  // -------------------------------- Invites ---------------------------------

  @Post(':id/invites')
  @ApiOperation({ summary: 'Invite people by email (moderators+)' })
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteMembersDto,
  ) {
    return this.communities.inviteMembers(user.id, user.role, id, dto);
  }
}
