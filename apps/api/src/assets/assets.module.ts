import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';

// Ensure upload directories exist
try {
  mkdirSync('./uploads/photos', { recursive: true });
  mkdirSync('./uploads/documents', { recursive: true });
} catch (e) {
  // ignore if already exists
}

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = file.fieldname === 'photos' ? './uploads/photos' : './uploads/documents';
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
