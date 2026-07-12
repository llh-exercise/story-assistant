import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { DeepSeekService } from '../ai/deepseek.service';

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  /** 防止同一故事并发触发多次目录生成 */
  private readonly generatingStoryIds = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly deepSeekService: DeepSeekService,
  ) {}

  findAll() {
    return this.prisma.story.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const story = await this.prisma.story.findUnique({ where: { id } });
    if (!story) {
      throw new NotFoundException(`故事 #${id} 不存在`);
    }
    return story;
  }

  async create(dto: CreateStoryDto) {
    const story = await this.prisma.story.create({
      data: {
        title: dto.title,
        outline: dto.outline,
        generationStatus: 'pending',
      },
    });

    void this.runGenerateChapterList(
      story.id,
      dto.title,
      dto.outline,
    );

    return story;
  }

  async update(id: number, dto: UpdateStoryDto) {
    await this.findOne(id);
    return this.prisma.story.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.story.delete({ where: { id } });
  }

  async getGenerationStatus(id: number) {
    const story = await this.findOne(id);
    return story.generationStatus;
  }

  /** 生成失败后整本重新生成章节目录 */
  async retryGenerateChapterList(id: number) {
    const story = await this.findOne(id);

    if (story.generationStatus === 'pending' || story.generationStatus === 'running') {
      throw new BadRequestException('目录正在生成中，请勿重复操作');
    }
    if (story.generationStatus !== 'failed') {
      throw new BadRequestException('仅生成失败时可重新生成');
    }
    if (this.generatingStoryIds.has(id)) {
      throw new BadRequestException('目录正在生成中，请勿重复操作');
    }

    await this.prisma.story.update({
      where: { id },
      data: { generationStatus: 'pending' },
    });

    void this.runGenerateChapterList(story.id, story.title, story.outline);

    return { message: '已开始重新生成章节目录' };
  }

  private async runGenerateChapterList(
    storyId: number,
    title: string,
    outline: string,
  ) {
    if (this.generatingStoryIds.has(storyId)) {
      return;
    }
    this.generatingStoryIds.add(storyId);

    try {
      await this.prisma.story.update({
        where: { id: storyId },
        data: { generationStatus: 'running' },
      });
      await this.deepSeekService.generateChapterList(storyId, title, outline);
      await this.prisma.story.update({
        where: { id: storyId },
        data: { generationStatus: 'done' },
      });
    } catch (error) {
      this.logger.error(
        `故事 #${storyId} 章节目录生成失败`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.prisma.story.update({
        where: { id: storyId },
        data: { generationStatus: 'failed' },
      });
    } finally {
      this.generatingStoryIds.delete(storyId);
    }
  }
}
