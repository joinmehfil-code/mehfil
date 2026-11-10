import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType, PostStatus, ReactionType } from '@mehfil/shared';

export class PollOptionDto {
  @IsString()
  @MaxLength(140)
  text: string;
}

export class CreatePollDto {
  @IsString()
  @MaxLength(200)
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  options: PollOptionDto[];

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}

/** Media already uploaded via /media/upload, referenced by URL. */
export class MediaRefDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsEnum(['IMAGE', 'VIDEO', 'FILE'])
  kind?: 'IMAGE' | 'VIDEO' | 'FILE';

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

export class ReactDto {
  @IsOptional()
  @IsEnum(ReactionType)
  type?: ReactionType;
}
