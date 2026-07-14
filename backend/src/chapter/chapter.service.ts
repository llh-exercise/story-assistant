import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly deepSeekService: DeepSeekService,
  ) {}

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

  /**
   * 创建卷/章。
   * - 传 afterId：插到该同级节点后面，事务内将后续兄弟 sortOrder +1
   * - 不传：追加到同级末尾（或使用显式 sortOrder）
   * - 新建卷（parentId 为 null）时，自动在其下创建默认第一章
   */
  async create(dto: CreateChapterDto) {
    return this.prisma.$transaction(async (tx) => {
      let parentId: number | null;
      let sortOrder: number;

      if (dto.afterId != null) {
        const after = await tx.chapter.findUnique({
          where: { id: dto.afterId },
        });
        if (!after) {
          throw new NotFoundException(`参照节点 #${dto.afterId} 不存在`);
        }
        if (after.storyId !== dto.storyId) {
          throw new BadRequestException('参照节点不属于当前故事');
        }

        parentId = after.parentId;
        sortOrder = after.sortOrder + 1;

        // 同级后续节点整体后移，为新节点腾出位置
        await tx.chapter.updateMany({
          where: {
            storyId: dto.storyId,
            parentId,
            sortOrder: { gte: sortOrder },
          },
          data: {
            sortOrder: { increment: 1 },
          },
        });
      } else {
        parentId = dto.parentId ?? null;
        sortOrder =
          dto.sortOrder ??
          (await this.getNextSortOrder(tx, dto.storyId, parentId));
      }

      const created = await tx.chapter.create({
        data: {
          storyId: dto.storyId,
          parentId,
          title: dto.title,
          outline: dto.outline,
          content: dto.content ?? '',
          sortOrder,
        },
      });

      // 新增卷时自动挂一个默认章节，避免空卷无法写作
      if (parentId == null) {
        await tx.chapter.create({
          data: {
            storyId: dto.storyId,
            parentId: created.id,
            title: '第一章',
            outline: '暂无',
            content: '',
            sortOrder: 0,
          },
        });
      }

      return created;
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
    client: Prisma.TransactionClient,
    storyId: number,
    parentId: number | null,
  ): Promise<number> {
    const result = await client.chapter.aggregate({
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
    chapterOutline: string,
  ): Promise<ChapterContentStreamResult> {
    return this.deepSeekService.streamChapterContent(
      storyId,
      chapterId,
      chapterTitle,
      chapterOutline,
    );
  }
}
