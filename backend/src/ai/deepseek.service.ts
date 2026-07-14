import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createChatModel } from '../utils/chat';
import { generateText, streamText } from 'ai';
import type { LanguageModel } from 'ai';
import type { Chapter } from '@prisma/client';
import {
  flattenChaptersInReadOrder,
  sortVolumes,
} from '../chapter/utils';

const VOLUMES_SYSTEM_PROMPT = `你是网络小说编辑。用户给出「故事名称」和「故事总纲」，请规划全书的「卷」结构。

【重要】你的回复只能是 JSON，不要 markdown 代码块，不要任何其它文字或解释。

JSON 结构（字段名必须一致）：
{"volumes":[{"title":"卷名","outline":"本卷概要，可空字符串","chapterCount":25}]}

规则：
- 至少包含 1 个 volume。
- title 必须为非空字符串；outline 可为空字符串或可省略。
- chapterCount 必须是正整数，表示该卷下计划有多少「章」（不是卷）。
- 根据故事总纲合理规划卷数与每卷章节数；长篇可拆成多卷，每卷 chapterCount 建议 20~50。`;

const VOLUME_CHAPTERS_SYSTEM_PROMPT = `你是网络小说编辑。用户给出故事总纲、上一卷/当前卷/下一卷细纲，以及本批要生成的章节范围，请生成本批章节目录。

【重要】你的回复只能是 JSON，不要 markdown 代码块，不要任何其它文字或解释。

JSON 结构（字段名必须一致）：
{"chapters":[{"title":"章标题","outline":"本章概要，可空字符串"}]}

规则：
- chapters 数组长度必须等于用户要求的「本批生成章数」。
- title 必须为非空字符串；outline 可为空字符串或可省略。
- 章节标题不要与已有章节重复。
- 情节以「当前卷细纲」为唯一主依据；故事总纲仅作世界观与人物背景参考。
- 严格只写当前卷范围内的情节，不得提前展开「下一卷细纲」中的主线与事件。
- 若当前卷仅「埋线 / 决心进入 / 引出下一卷」，就停在该收束点，禁止写成下一卷已开始推进的内容。
- 若有「上一卷细纲」，本批需自然承接其收束，且不要重复上一卷已写过的高潮。`;

const CONTENT_SYSTEM_PROMPT = `你是网络小说作者。根据给出的故事背景与本章细纲，撰写本章正文。
要求：
- 直接输出正文，不要标题、不要 markdown、不要解释
- 使用第三人称，语言流畅，符合网文节奏
- 字数控制在 2000~3000 字左右
- 遇到人物对话请另起一行，先输出 '\\n\\n' 再输出对话内容，对话完成后再输出 '\\n\\n' 再输出下一段内容`;

const CHAT_SYSTEM_PROMPT = `你是 Story Assistant 的智能助手，帮助用户进行小说创作相关的讨论与问答。

回答时必须使用 Markdown，并遵守以下格式：
1. 大点用中文序号单独成行：一、二、三、四……
2. 小点用阿拉伯数字列表：1. 2. 3. 4.……（相对大点缩进一层）
3. 需要强调的关键词句使用 **加粗**
4. 不要使用 HTML；不要用代码块包裹整段回答
5. 结构清晰，先总后分，避免无序号的大段堆砌

示例：
一、核心结论
1. 先说明 **主角动机**
2. 再交代冲突来源
二、具体建议
1. 细化场景动作
2. 补强人物关系`;

type GeneratedChapterPayload = {
  title: string;
  outline: string;
};

type GeneratedVolumePlan = {
  title: string;
  outline: string;
  chapterCount: number;
};

type VolumePlanPayload = {
  volumes: GeneratedVolumePlan[];
};

type ChaptersBatchPayload = {
  chapters: GeneratedChapterPayload[];
};

/** streamText 对外暴露的核心能力（避免 ai SDK 内部 Output 类型无法导出） */
export interface ChapterContentStreamResult {
  textStream: AsyncIterable<string>;
  toTextStreamResponse: () => Response;
}

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** 同步写入目录生成进度文案，供前端轮询展示 */
  private async setGenerationMessage(storyId: number, message: string) {
    await this.prisma.story.update({
      where: { id: storyId },
      data: { generationMessage: message },
    });
  }

  /** 分批：先规划卷，再按卷分批生成章节目录并写入 chapter 表 */
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

    const model = this.createChatModel();
    const batchSize = this.getChapterBatchSize();

    await this.prisma.chapter.deleteMany({ where: { storyId } });

    await this.setGenerationMessage(storyId, '正在规划卷结构...');
    const volumePlan = await this.generateVolumePlan(model, storyName, outline);
    const allCreated: Chapter[] = [];

    const startMsg = `目录生成开始：共 ${volumePlan.volumes.length} 卷`;
    this.logger.log(`故事 #${storyId} ${startMsg}`);
    await this.setGenerationMessage(storyId, startMsg);

    for (let volumeIndex = 0; volumeIndex < volumePlan.volumes.length; volumeIndex++) {
      const volume = volumePlan.volumes[volumeIndex];
      const volumeRow = await this.prisma.chapter.create({
        data: {
          storyId,
          parentId: null,
          title: volume.title,
          outline: volume.outline,
          content: '',
          sortOrder: volumeIndex,
        },
      });
      allCreated.push(volumeRow);

      const volumeStartMsg = `卷「${volume.title}」开始生成，计划 ${volume.chapterCount} 章`;
      this.logger.log(`故事 #${storyId} ${volumeStartMsg}`);
      await this.setGenerationMessage(storyId, volumeStartMsg);

      let generatedInVolume = 0;
      const existingTitles: string[] = [];

      while (generatedInVolume < volume.chapterCount) {
        const currentBatchSize = Math.min(
          batchSize,
          volume.chapterCount - generatedInVolume,
        );
        const startChapterNo = generatedInVolume + 1;

        const chapters = await this.generateVolumeChaptersBatch(
          model,
          storyName,
          outline,
          volume,
          volumePlan.volumes[volumeIndex - 1] ?? null,
          volumePlan.volumes[volumeIndex + 1] ?? null,
          volumeIndex + 1,
          startChapterNo,
          currentBatchSize,
          existingTitles,
        );

        if (chapters.length === 0) {
          throw new BadRequestException(
            `卷「${volume.title}」第 ${startChapterNo} 章起生成失败：模型未返回章节`,
          );
        }

        for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
          const chapter = chapters[chapterIndex];
          const chapterRow = await this.prisma.chapter.create({
            data: {
              storyId,
              parentId: volumeRow.id,
              title: chapter.title,
              outline: chapter.outline,
              content: '',
              sortOrder: generatedInVolume + chapterIndex,
            },
          });
          allCreated.push(chapterRow);
          existingTitles.push(chapter.title);
        }

        generatedInVolume += chapters.length;

        const progressMsg = `卷「${volume.title}」进度 ${generatedInVolume}/${volume.chapterCount}`;
        this.logger.log(`故事 #${storyId} ${progressMsg}`);
        await this.setGenerationMessage(storyId, progressMsg);

        if (chapters.length < currentBatchSize) {
          this.logger.warn(
            `故事 #${storyId} 卷「${volume.title}」本批仅返回 ${chapters.length} 章，提前结束该卷`,
          );
          break;
        }
      }
    }

    const doneMsg = `目录生成完成，共 ${allCreated.length} 条（含卷）`;
    this.logger.log(`故事 #${storyId} ${doneMsg}`);
    await this.setGenerationMessage(storyId, doneMsg);

    return allCreated;
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

    const model = this.createChatModel();

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

  /** 通用多轮对话流式输出（配置页调试用） */
  async streamChat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  ): Promise<ChapterContentStreamResult> {
    if (!messages.length) {
      throw new BadRequestException('消息列表不能为空');
    }

    const model = this.createChatModel();
    const systemFromMessages = messages
      .filter((item) => item.role === 'system')
      .map((item) => item.content.trim())
      .filter(Boolean)
      .join('\n\n');
    const conversation = messages.filter((item) => item.role !== 'system');

    return streamText({
      model,
      system: systemFromMessages || CHAT_SYSTEM_PROMPT,
      messages: conversation.map((item) => ({
        role: item.role,
        content: item.content,
      })),
      temperature: 0.5,
    }) as ChapterContentStreamResult;
  }

  private createChatModel(): LanguageModel {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadRequestException('未配置 DEEPSEEK_API_KEY 环境变量');
    }

    return createChatModel({
      provider: 'deepseek',
      apiKey,
      apiBase:
        this.config.get<string>('DEEPSEEK_API_BASE')?.trim() ||
        'https://api.deepseek.com',
      model:
        this.config.get<string>('DEEPSEEK_MODEL')?.trim() || 'deepseek-chat',
    });
  }

  private getChapterBatchSize(): number {
    const raw = this.config.get<string>('CHAPTER_BATCH_SIZE');
    const parsed = raw ? Number.parseInt(raw, 10) : 30;
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 30;
    }
    return Math.min(parsed, 50);
  }

  private async generateJsonFromModel(
    model: LanguageModel,
    system: string,
    prompt: string,
  ): Promise<unknown> {
    const { text } = await generateText({
      model,
      system,
      prompt,
      temperature: 0.2,
    });

    if (!text?.trim()) {
      throw new BadRequestException('模型未返回内容');
    }

    const jsonStr = extractJsonObject(text);
    try {
      return JSON.parse(jsonStr) as unknown;
    } catch {
      throw new BadRequestException('模型返回的 JSON 无法解析');
    }
  }

  /** 第 1 步：规划各卷及每卷章节数 */
  private async generateVolumePlan(
    model: LanguageModel,
    storyName: string,
    outline: string,
  ): Promise<VolumePlanPayload> {
    const parsed = await this.generateJsonFromModel(
      model,
      VOLUMES_SYSTEM_PROMPT,
      [
        '以下为故事名称和总纲，请输出符合要求的 JSON：',
        '',
        `故事名称：${storyName}`,
        `故事总纲：${outline}`,
      ].join('\n'),
    );

    return normalizeVolumePlanPayload(parsed);
  }

  /** 第 2 步：为某一卷分批生成章节 */
  private async generateVolumeChaptersBatch(
    model: LanguageModel,
    storyName: string,
    storyOutline: string,
    volume: GeneratedVolumePlan,
    prevVolume: GeneratedVolumePlan | null,
    nextVolume: GeneratedVolumePlan | null,
    volumeNo: number,
    startChapterNo: number,
    batchSize: number,
    existingTitles: string[],
  ): Promise<GeneratedChapterPayload[]> {
    const existingText =
      existingTitles.length > 0
        ? existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')
        : '（本卷尚无已生成章节）';

    const formatVolumeBlock = (
      label: string,
      vol: GeneratedVolumePlan | null,
      no: number | null,
    ): string => {
      if (!vol || no == null) {
        return `${label}：（无）`;
      }
      return [
        `${label}：第 ${no} 卷《${vol.title}》`,
        `细纲：${vol.outline?.trim() || '（无）'}`,
      ].join('\n');
    };

    const parsed = await this.generateJsonFromModel(
      model,
      VOLUME_CHAPTERS_SYSTEM_PROMPT,
      [
        `故事名称：${storyName}`,
        `故事总纲：${storyOutline}`,
        '',
        formatVolumeBlock('上一卷细纲', prevVolume, volumeNo > 1 ? volumeNo - 1 : null),
        '',
        formatVolumeBlock('当前卷细纲', volume, volumeNo),
        `本卷计划总章数：${volume.chapterCount}`,
        '',
        formatVolumeBlock('下一卷细纲', nextVolume, nextVolume ? volumeNo + 1 : null),
        '',
        '【边界约束】情节以当前卷细纲为准；不得提前写下一卷主线；需承接上一卷收束。',
        '',
        `本批请生成第 ${startChapterNo} ~ ${startChapterNo + batchSize - 1} 章，共 ${batchSize} 章。`,
        '',
        '本卷已生成章节（勿重复标题）：',
        existingText,
      ].join('\n'),
    );

    const payload = normalizeChaptersBatchPayload(parsed);
    if (payload.chapters.length !== batchSize) {
      this.logger.warn(
        `卷「${volume.title}」本批期望 ${batchSize} 章，实际 ${payload.chapters.length} 章`,
      );
    }

    return payload.chapters;
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

function asPositiveInt(value: unknown, field: string): number {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : NaN;
  if (!Number.isFinite(num) || num < 1) {
    throw new BadRequestException(`${field} 必须为正整数`);
  }
  return Math.floor(num);
}

/** 校验卷规划 JSON */
function normalizeVolumePlanPayload(raw: unknown): VolumePlanPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('卷规划 JSON 根节点必须为对象');
  }

  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.volumes) || root.volumes.length === 0) {
    throw new BadRequestException('卷规划 JSON 至少包含 1 个 volume');
  }

  const volumes: GeneratedVolumePlan[] = root.volumes.map((volume, vi) => {
    if (!volume || typeof volume !== 'object' || Array.isArray(volume)) {
      throw new BadRequestException(`volumes[${vi}] 必须为对象`);
    }
    const vol = volume as Record<string, unknown>;
    return {
      title: asNonEmptyString(vol.title, `volumes[${vi}].title`),
      outline: asOutlineString(vol.outline, `volumes[${vi}].outline`),
      chapterCount: asPositiveInt(
        vol.chapterCount,
        `volumes[${vi}].chapterCount`,
      ),
    };
  });

  return { volumes };
}

/** 校验单批章节 JSON */
function normalizeChaptersBatchPayload(raw: unknown): ChaptersBatchPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('章节批次 JSON 根节点必须为对象');
  }

  const root = raw as Record<string, unknown>;
  if (!Array.isArray(root.chapters) || root.chapters.length === 0) {
    throw new BadRequestException('章节批次 JSON 至少包含 1 个 chapter');
  }

  const chapters: GeneratedChapterPayload[] = root.chapters.map(
    (chapter, ci) => {
      if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) {
        throw new BadRequestException(`chapters[${ci}] 必须为对象`);
      }
      const ch = chapter as Record<string, unknown>;
      return {
        title: asNonEmptyString(ch.title, `chapters[${ci}].title`),
        outline: asOutlineString(ch.outline, `chapters[${ci}].outline`),
      };
    },
  );

  return { chapters };
}

/** 格式化各卷大纲 */
function formatVolumeOutlines(volumes: Chapter[]): string {
  if (volumes.length === 0) {
    return '（无）';
  }
  return volumes
    .map(
      (volume, index) =>
        `${index + 1}. ${volume.title}：${volume.outline || '（无）'}`,
    )
    .join('\n');
}

/** 格式化前五章细纲 */
function formatPreviousChapterOutlines(chapters: Chapter[]): string {
  if (chapters.length === 0) {
    return '（无，本章为全书第一章）';
  }
  return chapters
    .map(
      (chapter, index) =>
        `${index + 1}. ${chapter.title}：${chapter.outline || '（无）'}`,
    )
    .join('\n');
}
