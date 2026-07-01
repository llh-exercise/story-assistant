import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createChatModel } from '../utils/chat';
import { generateText, streamText } from 'ai';
import type { Chapter } from '@prisma/client';
import {
  flattenChaptersInReadOrder,
  sortVolumes,
} from '../chapter/utils';

const SYSTEM_PROMPT = `你是网络小说编辑。用户给出「故事名称」和「故事总纲」，请根据故事名称和总纲设计卷与章的目录。

【重要】你的回复只能是 JSON，不要 markdown 代码块，不要任何其它文字或解释。

JSON 结构（字段名必须一致）：
{"volumes":[{"title":"卷名","outline":"本卷概要，可空字符串","chapters":[{"title":"章标题","outline":"本章概要，可空字符串"}]}]}

规则：
- 至少包含 1 个 volume；每个 volume 至少包含 1 个 chapter。
- title 必须为非空字符串；outline 可为空字符串或可省略（省略时视为空）。`;

const CONTENT_SYSTEM_PROMPT = `你是网络小说作者。根据给出的故事背景与本章细纲，撰写本章正文。
要求：
- 直接输出正文，不要标题、不要 markdown、不要解释
- 使用第三人称，语言流畅，符合网文节奏
- 字数控制在 2000~3000 字左右
- 遇到人物对话请另起一行，先输出 '\n\n' 再输出对话内容，对话完成后再输出 '\n\n' 再输出下一段内容`;

type GeneratedChapterPayload = {
  title: string;
  outline: string;
};

type GeneratedVolumePayload = {
  title: string;
  outline: string;
  chapters: GeneratedChapterPayload[];
};

type MuluPayload = {
  volumes: GeneratedVolumePayload[];
};

/** streamText 对外暴露的核心能力（避免 ai SDK 内部 Output 类型无法导出） */
export interface ChapterContentStreamResult {
  textStream: AsyncIterable<string>;
  toTextStreamResponse: () => Response;
}

@Injectable()
export class DeepSeekService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 根据故事总纲生成章节目录并写入 chapter 表 */
  async generateChapterList(
    storyId: number,
    storyName: string,
    outline: string,
  ): Promise<Chapter[]> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException(`故事 #${storyId} 不存在`);
    }

    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException('未配置 DEEPSEEK_API_KEY 环境变量');
    }

    const model = createChatModel({
      provider: 'deepseek',
      apiKey,
      apiBase:
        this.config.get<string>('DEEPSEEK_API_BASE')?.trim() ||
        'https://api.deepseek.com',
      model:
        this.config.get<string>('DEEPSEEK_MODEL')?.trim() || 'deepseek-chat',
    });

    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `以下为故事名称和总纲，请输出符合要求的 JSON：\n\n故事名称：${storyName}\n故事总纲：${outline}`,
      temperature: 0.2,
    });

    if (!text?.trim()) {
      throw new BadRequestException('模型未返回内容');
    }

    const jsonStr = extractJsonObject(text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr) as unknown;
    } catch {
      throw new BadRequestException('模型返回的 JSON 无法解析');
    }

    const payload = normalizeMuluPayload(parsed);
    return this.persistMuluPayload(storyId, payload);
  }

  /** 将规范化后的卷/章目录写入数据库（卷 parentId 为 null，章 parentId 指向所属卷） */
  private async persistMuluPayload(
    storyId: number,
    payload: MuluPayload,
  ): Promise<Chapter[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.chapter.deleteMany({ where: { storyId } });

      const created: Chapter[] = [];
      // [2026-06-29] 按 AI 返回顺序写入 sortOrder，便于后续手动插章/增卷
      for (let volumeIndex = 0; volumeIndex < payload.volumes.length; volumeIndex++) {
        const volume = payload.volumes[volumeIndex];
        const volumeRow = await tx.chapter.create({
          data: {
            storyId,
            parentId: null,
            title: volume.title,
            outline: volume.outline,
            content: '',
            sortOrder: volumeIndex,
          },
        });
        created.push(volumeRow);

        for (let chapterIndex = 0; chapterIndex < volume.chapters.length; chapterIndex++) {
          const chapter = volume.chapters[chapterIndex];
          const chapterRow = await tx.chapter.create({
            data: {
              storyId,
              parentId: volumeRow.id,
              title: chapter.title,
              outline: chapter.outline,
              content: '',
              sortOrder: chapterIndex,
            },
          });
          created.push(chapterRow);
        }
      }

      return created;
    });
  }

  /** 流式生成本章正文 */
  async streamChapterContent(
    storyId: number,
    chapterId: number,
    chapterTitle: string,
    chapterOutline: string,
  ): Promise<ChapterContentStreamResult> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException(`故事 #${storyId} 不存在`);
    }

    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, storyId },
      include: { parent: true },
    });
    if (!chapter) {
      throw new NotFoundException(`章节 #${chapterId} 不存在`);
    }
    if (chapter.parentId == null) {
      throw new BadRequestException('只能为章节（非卷）生成正文');
    }

    const allChapters = await this.prisma.chapter.findMany({
      where: { storyId },
      // [2026-06-29] 阅读顺序改由 sortOrder 决定，不再依赖 createdAt
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const volumes = sortVolumes(allChapters);
    const volumeOutlinesText = formatVolumeOutlines(volumes);

    const flatChapters = flattenChaptersInReadOrder(allChapters);
    const currentIndex = flatChapters.findIndex((item) => item.id === chapterId);
    const previousChapters =
      currentIndex > 0
        ? flatChapters.slice(Math.max(0, currentIndex - 5), currentIndex)
        : [];
    const previousOutlinesText = formatPreviousChapterOutlines(previousChapters);

    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException('未配置 DEEPSEEK_API_KEY 环境变量');
    }

    const model = createChatModel({
      provider: 'deepseek',
      apiKey,
      apiBase:
        this.config.get<string>('DEEPSEEK_API_BASE')?.trim() ||
        'https://api.deepseek.com',
      model:
        this.config.get<string>('DEEPSEEK_MODEL')?.trim() || 'deepseek-chat',
    });

    const prompt = [
      `故事名称：${story.title}`,
      `故事总纲：${story.outline}`,
      '',
      '每一卷的大纲：',
      volumeOutlinesText,
      '',
      `所属卷：${chapter.parent?.title ?? ''}`,
      '',
      '当前章节之前的五章细纲：',
      previousOutlinesText,
      '',
      `本章标题：${chapterTitle}`,
      `本章细纲：${chapterOutline}`,
      '',
      '请根据以上信息撰写本章正文：',
    ].join('\n');

    return streamText({
      model,
      system: CONTENT_SYSTEM_PROMPT,
      prompt,
      temperature: 0.8,
    }) as ChapterContentStreamResult;
  }
}

function extractJsonObject(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/im.exec(s);
  if (fence) {
    s = fence[1].trim();
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new BadRequestException('模型返回中未找到 JSON 对象');
  }
  return s.slice(start, end + 1);
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field} 必须为非空字符串`);
  }
  return value.trim();
}

function asOutlineString(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} 必须为字符串`);
  }
  return value;
}

/** 校验并规范化模型返回的目录 JSON */
function normalizeMuluPayload(raw: unknown): MuluPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('目录 JSON 根节点必须为对象');
  }

  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.volumes) || root.volumes.length === 0) {
    throw new BadRequestException('目录 JSON 至少包含 1 个 volume');
  }

  const volumes: GeneratedVolumePayload[] = root.volumes.map((volume, vi) => {
    if (!volume || typeof volume !== 'object' || Array.isArray(volume)) {
      throw new BadRequestException(`volumes[${vi}] 必须为对象`);
    }
    const vol = volume as Record<string, unknown>;
    if (!Array.isArray(vol.chapters) || vol.chapters.length === 0) {
      throw new BadRequestException(
        `volumes[${vi}] 至少包含 1 个 chapter`,
      );
    }

    const chapters: GeneratedChapterPayload[] = vol.chapters.map(
      (chapter, ci) => {
        if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) {
          throw new BadRequestException(
            `volumes[${vi}].chapters[${ci}] 必须为对象`,
          );
        }
        const ch = chapter as Record<string, unknown>;
        return {
          title: asNonEmptyString(
            ch.title,
            `volumes[${vi}].chapters[${ci}].title`,
          ),
          outline: asOutlineString(
            ch.outline,
            `volumes[${vi}].chapters[${ci}].outline`,
          ),
        };
      },
    );

    return {
      title: asNonEmptyString(vol.title, `volumes[${vi}].title`),
      outline: asOutlineString(vol.outline, `volumes[${vi}].outline`),
      chapters,
    };
  });

  return { volumes };
}

/** 格式化各卷大纲 */
function formatVolumeOutlines(volumes: Chapter[]): string {
  if (volumes.length === 0) {
    return '（无）';
  }
  return volumes
    .map((volume, index) => `${index + 1}. ${volume.title}：${volume.outline || '（无）'}`)
    .join('\n');
}

/** 格式化前五章细纲 */
function formatPreviousChapterOutlines(chapters: Chapter[]): string {
  if (chapters.length === 0) {
    return '（无，本章为全书第一章）';
  }
  return chapters
    .map((chapter, index) => `${index + 1}. ${chapter.title}：${chapter.outline || '（无）'}`)
    .join('\n');
}
