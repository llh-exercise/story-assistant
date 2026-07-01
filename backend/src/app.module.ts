import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { StoriesModule } from './stories/stories.module';
import { ChapterModule } from './chapter/chapter.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StoriesModule,
    ChapterModule,
  ],
})
export class AppModule {}
