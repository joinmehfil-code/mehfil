import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname, resolve } from 'path';
import { randomBytes } from 'crypto';
import { MediaKind } from '@mehfil/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface StoredFile {
  url: string;
  path: string;
  mimeType: string;
  bytes: number;
  kind: MediaKind;
}

/**
 * MediaService — Phase 1 stores uploads on local disk under /uploads (served
 * statically). The public interface is storage-agnostic so S3/CDN can be swapped
 * in later without changing callers.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = resolve(
      process.cwd(),
      this.config.get<string>('app.upload.dir') || 'uploads',
    );
    if (!existsSync(this.uploadDir)) mkdirSync(this.uploadDir, { recursive: true });
  }

  private kindFromMime(mime: string): MediaKind {
    if (mime.startsWith('image/')) return 'IMAGE' as MediaKind;
    if (mime.startsWith('video/')) return 'VIDEO' as MediaKind;
    return 'FILE' as MediaKind;
  }

  /** Persist an uploaded buffer to disk and return its public URL. */
  async store(
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    folder = 'general',
  ): Promise<StoredFile> {
    if (!file?.buffer) throw new BadRequestException('No file provided');
    const dir = join(this.uploadDir, folder);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const ext = extname(file.originalname).toLowerCase() || '';
    const name = `${Date.now()}_${randomBytes(8).toString('hex')}${ext}`;
    const fullPath = join(dir, name);

    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(fullPath);
      ws.on('finish', () => resolve());
      ws.on('error', reject);
      ws.end(file.buffer);
    });

    const url = `/uploads/${folder}/${name}`;
    return {
      url,
      path: fullPath,
      mimeType: file.mimetype,
      bytes: file.size,
      kind: this.kindFromMime(file.mimetype),
    };
  }

  /** Create a Media row linked to an owner entity (post/message/user/etc.). */
  async createRecord(params: {
    stored: StoredFile;
    userId?: string;
    postId?: string;
    messageId?: string;
    eventId?: string;
    communityId?: string;
    kind?: MediaKind;
  }) {
    return this.prisma.media.create({
      data: {
        url: params.stored.url,
        kind: (params.kind ?? params.stored.kind) as MediaKind,
        mimeType: params.stored.mimeType,
        bytes: params.stored.bytes,
        userId: params.userId,
        postId: params.postId,
        messageId: params.messageId,
        eventId: params.eventId,
        communityId: params.communityId,
      },
    });
  }

  /** Delete a file from disk (best effort). */
  removeByUrl(url: string): void {
    try {
      if (!url?.startsWith('/uploads/')) return;
      const rel = url.replace('/uploads/', '');
      const full = join(this.uploadDir, rel);
      if (existsSync(full)) unlinkSync(full);
    } catch (err) {
      this.logger.warn(`Failed to delete file ${url}: ${(err as Error).message}`);
    }
  }

  /** Map a stored media row to the API shape. */
  toApi(m: {
    id: string;
    url: string;
    kind: MediaKind | string;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    thumbnailUrl: string | null;
  }) {
    return {
      id: m.id,
      url: m.url,
      kind: m.kind,
      mimeType: m.mimeType ?? undefined,
      width: m.width ?? undefined,
      height: m.height ?? undefined,
      thumbnailUrl: m.thumbnailUrl,
    };
  }
}
