import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChapterService } from './chapter.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { GenerateChapterContentDto } from './dto/generate-chapter-content.dto';
import { FastifyReply } from 'fastify';

@ApiTags('chapters')
@Controller('chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Get(':storyId')
  @ApiOperation({ summary: '获取章节列表' })
  findAllByStoryId(@Param('storyId', ParseIntPipe) storyId: number) {
    return this.chapterService.findAllByStoryId(storyId);
  }

  @Get('chapter/:id')
  @ApiOperation({ summary: '获取章节详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.chapterService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建章节' })
  create(@Body() dto: CreateChapterDto) {
    return this.chapterService.create(dto);
  }

  @Post(':id/generate-content/stream')
  @ApiOperation({ summary: '根据细纲流式生成本章正文' })
  // @SkipResponseTransform()  // 必须跳过 { code, data, msg } 包装
  async generateContentStream(
    @Param('id', ParseIntPipe) chapterId: number,
    @Body() dto: GenerateChapterContentDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // 1. 查章节，拿 storyId / title / 默认 outline
    const chapter = await this.chapterService.findOne(chapterId);
    if (chapter.parentId == null) {
      reply.status(400).send({ msg: '只能为章节（非卷）生成正文' });
      return;
    }
    const chapterTitle = chapter.title;
    const chapterOutline = dto.outline?.trim() || chapter.outline;
    if (!chapterOutline) {
      reply.status(400).send({ msg: '请先填写细纲' });
      return;
    }
    // 2. 调 AI 流
    const result = await this.chapterService.prepareContentStream(
      chapter.storyId,
      chapterId,
      chapterTitle,
      chapterOutline,
    );
    // 3. 直接写流式响应（打字机靠这个）
    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');
    try {
      for await (const chunk of result.textStream) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
    } catch(error) {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新章节' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chapterService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除章节' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chapterService.remove(id);
  }
}
