import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ProfileVisibility } from '@mehfil/shared';

/** Update the authenticated user's own profile. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aboutMe?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsEnum(ProfileVisibility)
  visibility?: ProfileVisibility;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(en|ur)$/, { message: 'locale must be en or ur' })
  locale?: string;
}

/** Query params for discovering/searching people. */
export class SearchUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  interest?: string;

  @IsOptional()
  @IsString()
  skill?: string;
}

/** Add/remove a skill on the profile. */
export class UpsertSkillDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsEnum(['OFFER', 'WANT'] as const, {
    message: 'relation must be OFFER or WANT',
  })
  relation: 'OFFER' | 'WANT';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  level?: string;
}
