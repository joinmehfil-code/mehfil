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
import { ReactionType } from '@mehfil/shared';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PostsService } from './posts.service';
import { toPostApi, toCommentApi, PostWithRelations, CommentWithRelations } from './post.mapper';
import { CreatePostDto, UpdatePostDto, CreateCommentDto, ReactDto } from './dto/post.dto';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a post (text, media, poll)' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    const post = await this.posts.createPost(user.id, dto);
    return toPostApi(post as PostWithRelations, user.id);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Personalized home feed' })
  feed(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.posts.getFeed(user.id, pagination.page, pagination.limit);
  }

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Trending posts' })
  trending(@CurrentUser() user: AuthUser | undefined, @Query() pagination: PaginationQueryDto) {
    return this.posts.trending(user?.id ?? '', pagination.page, pagination.limit);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: 'My bookmarked posts' })
  bookmarks(@CurrentUser() user: AuthUser, @Query() pagination: PaginationQueryDto) {
    return this.posts.listBookmarks(user.id, pagination.page, pagination.limit);
  }

  @Get('hashtag/:tag')
  @Public()
  @ApiOperation({ summary: 'Posts by hashtag' })
  byHashtag(
    @Param('tag') tag: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.posts.getByHashtag(tag, user?.id ?? '', pagination.page, pagination.limit);
  }

  @Get('user/:userId')
  @Public()
  @ApiOperation({ summary: "Posts on a user's profile" })
  userPosts(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.posts.getUserPosts(userId, user?.id, pagination.page, pagination.limit);
  }

  @Get('community/:communityId')
  @Public()
  @ApiOperation({ summary: 'Posts in a community (optionally a space)' })
  communityPosts(
    @Param('communityId') communityId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() pagination: PaginationQueryDto,
    @Query('spaceId') spaceId?: string,
  ) {
    return this.posts.getCommunityPosts(
      communityId,
      user?.id,
      pagination.page,
      pagination.limit,
      spaceId,
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single post' })
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.posts.getPost(id, user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a post' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    const post = await this.posts.updatePost(user.id, id, dto);
    return toPostApi(post as PostWithRelations, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post (soft delete)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.deletePost(user.id, id, user.role !== 'USER' && user.role !== undefined);
  }

  // ------------------------------- Reactions -------------------------------

  @Post(':id/reactions')
  @ApiOperation({ summary: 'React to a post' })
  react(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReactDto,
  ) {
    return this.posts.toggleReaction(user.id, { postId: id }, dto.type ?? ReactionType.LIKE);
  }

  @Delete(':id/reactions')
  @ApiOperation({ summary: 'Remove my reaction from a post' })
  unreact(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.toggleReaction(user.id, { postId: id }, ReactionType.LIKE);
  }

  // -------------------------------- Comments --------------------------------

  @Get(':id/comments')
  @Public()
  @ApiOperation({ summary: 'List comments on a post' })
  comments(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query('limit') limit?: string,
  ) {
    return this.posts.listComments(id, user?.id, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  async addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.posts.addComment(user.id, id, dto);
    return toCommentApi(comment as CommentWithRelations, user.id);
  }

  // -------------------------------- Polls -----------------------------------

  @Post('poll/:optionId/vote')
  @ApiOperation({ summary: 'Vote on a poll option' })
  vote(@CurrentUser() user: AuthUser, @Param('optionId') optionId: string) {
    return this.posts.votePoll(user.id, optionId);
  }

  // ------------------------------- Bookmarks --------------------------------

  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark on a post' })
  bookmark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.toggleBookmark(user.id, id);
  }

  @Post(':id/share')
  @Public()
  @ApiOperation({ summary: 'Register a share of a post' })
  share(@Param('id') id: string) {
    return this.posts.sharePost(id);
  }
}

/** Comment moderation endpoints (staff only). */
@ApiTags('moderation')
@Controller('comments')
export class CommentsController {
  constructor(private readonly posts: PostsService) {}

  @Delete(':id')
  @Roles('MODERATOR', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a comment (author or staff)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.posts.deleteComment(user.id, id, user.role !== 'USER');
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: 'React to a comment' })
  react(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReactDto) {
    return this.posts.toggleReaction(user.id, { commentId: id }, dto.type ?? ReactionType.LIKE);
  }
}
