import { del, get, patch, post } from './request';
import type { Chapter } from '../types/chapter';
import { ApiResponse } from '../types/request';

export type ChapterPayload = Pick<Chapter, 'storyId' | 'title' | 'outline'> &
  Partial<Pick<Chapter, 'content' | 'parentId' | 'sortOrder'>> & {
    /** 插在该同级节点之后 */
    afterId?: number;
  };

export type UpdateChapterPayload = Partial<ChapterPayload>;

export const chapterApi = {
  /** GET /api/chapters */
  getList(storyId: number) {
    return get<ApiResponse<Chapter[]>>(`/chapters/${storyId}`);
  },
  getChapterById(id: number) {
    return get<ApiResponse<Chapter>>(`/chapters/chapter/${id}`);
  },
  /** POST /api/chapters */
  createChapter(data: ChapterPayload) {
    return post<ApiResponse<Chapter>>('/chapters', data);
  },
  /** PATCH /api/chapters/:id */
  updateChapter(id: number, data: UpdateChapterPayload) {
    return patch<ApiResponse<Chapter>>(`/chapters/${id}`, data);
  },
  /** DELETE /api/chapters/:id */
  deleteChapter(id: number) {
    return del<ApiResponse<Chapter>>(`/chapters/${id}`);
  },
  async generateChapterContentStream(
    chapterId: number,
    outline: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ) {
    const res = await fetch(`/api/chapters/${chapterId}/generate-content/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outline }), // 传当前编辑器里的细纲
      signal,
    });
    if (!res.ok || !res.body) throw new Error('生成失败');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
  }
};
