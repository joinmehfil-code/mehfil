import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user.type';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a single file (image/video/file)' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    const stored = await this.media.store(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      folder || 'general',
    );
    const record = await this.media.createRecord({ stored, userId: user.id });
    return this.media.toApi(record);
  }

  @Post('upload-many')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple files at once' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMany(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    const results: ReturnType<MediaService['toApi']>[] = [];
    for (const f of files || []) {
      const stored = await this.media.store(
        { buffer: f.buffer, originalname: f.originalname, mimetype: f.mimetype, size: f.size },
        folder || 'general',
      );
      const record = await this.media.createRecord({ stored, userId: user.id });
      results.push(this.media.toApi(record));
    }
    return results;
  }
}
