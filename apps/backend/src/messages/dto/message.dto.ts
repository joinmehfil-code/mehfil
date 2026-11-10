import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConversationType, MessageType } from '@mehfil/shared';
import { MediaRefDto } from '../../posts/dto/post.dto';

export class StartConversationDto {
  /** For a DIRECT conversation, the other user's id. */
  @IsOptional()
  @IsString()
  recipientId?: string;

  /** For a GROUP conversation, all member ids (including self). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Allows sending to a direct recipient without a known conversation id. */
  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MediaRefDto)
  media?: MediaRefDto[];
}

export class MarkReadDto {
  @IsString()
  conversationId: string;
}

export class TypingDto {
  @IsString()
  conversationId: string;

  @IsOptional()
  @IsBoolean()
  isTyping?: boolean;
}
