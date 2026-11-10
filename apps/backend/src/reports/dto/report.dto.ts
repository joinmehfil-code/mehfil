import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportTargetType, ReportReason, ReportStatus } from '@mehfil/shared';

export const MODERATION_ACTIONS = [
  'NONE',
  'REMOVE_CONTENT',
  'SUSPEND_USER',
  'BAN_USER',
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsString()
  targetId: string;

  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}

export class ResolveReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;

  @IsOptional()
  @IsIn(MODERATION_ACTIONS as unknown as string[])
  action?: ModerationAction;
}

export class ReportQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;
}
