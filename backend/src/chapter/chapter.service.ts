import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeepSeekService } from '../ai/deepseek.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import {
  buildSortOrderBackfillUpdates,
  convertChaptersToTree,
} from './utils';
import { ChapterContentStreamResult } from '../ai/deepseek.service';

@Injectable()
export class ChapterService {
  constructor(private readonly prisma: PrismaService, private readonly deepSeekService: DeepSeekService) {}

  async findAllByStoryId(storyId: number) {
    // [2026-06-29] 旧数据 sortOrder 全为 0 时，按 createdAt 回填一次
    await this.backfillLegacySortOrderIfNeeded(storyId);

    const chapters = await this.prisma.chapter.findMany({
      where: { storyId },
      // [2026-06-29] 查询顺序仅作兜底，树形/阅读顺序以 sortOrder 为准
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    return convertChaptersToTree(chapters);
  }

  async findOne(id: number) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id } });
    if (!chapter) {
      throw new NotFoundException(`章节 #${id} 不存在`);
    }
    return chapter;
  }

  async create(dto: CreateChapterDto) {
    const parentId = dto.parentId ?? null;
    const sortOrder =
      dto.sortOrder ?? (await this.getNextSortOrder(dto.storyId, parentId));

    return this.prisma.chapter.create({
      data: {
        storyId: dto.storyId,
        parentId,
        title: dto.title,
        outline: dto.outline,
        content: dto.content ?? '',
        sortOrder,
      },
    });
  }

  async update(id: number, dto: UpdateChapterDto) {
    await this.findOne(id);
    return this.prisma.chapter.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.chapter.delete({ where: { id } });
  }

  /** [2026-06-29] 获取同级下一个 sortOrder（追加到末尾） */
  private async getNextSortOrder(
    storyId: number,
    parentId: number | null,
  ): Promise<number> {
    const result = await this.prisma.chapter.aggregate({
      where: { storyId, parentId },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  /** [2026-06-29] 旧数据回填：仅当某同级分组内全部 sortOrder 为 0 时触发 */
  private async backfillLegacySortOrderIfNeeded(storyId: number): Promise<void> {
    const chapters = await this.prisma.chapter.findMany({
      where: { storyId },
      select: { id: true, parentId: true, sortOrder: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const updates = buildSortOrderBackfillUpdates(chapters);
    if (updates.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      updates.map((item) =>
        this.prisma.chapter.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }

  async prepareContentStream(
    storyId: number,
    chapterId: number,
    chapterTitle: string,
    chapterOutline: string
  ): Promise<ChapterContentStreamResult> {
    return this.deepSeekService.streamChapterContent(
      storyId,
      chapterId,
      chapterTitle,
      chapterOutline,
    );
  }
}
