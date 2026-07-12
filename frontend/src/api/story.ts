import { del, get, patch, post } from './request';
import type { Story, StoryGenerationStatus } from '../types/story';
import { ApiResponse } from '../types/request';

export type StoryPayload = Pick<Story, 'title' | 'outline'>;

export const storyApi = {
  /** GET /api/stories */
  getList() {
    return get<ApiResponse<Story[]>>('/stories');
  },
  getStoryById(id: number) {
    return get<ApiResponse<Story>>(`/stories/${id}`);
  },
  /** GET /api/stories/:id/generation-status */
  getGenerationStatus(id: number) {
    return get<ApiResponse<StoryGenerationStatus>>(
      `/stories/${id}/generation-status`,
    );
  },
  /** POST /api/stories */
  createStory(data: StoryPayload) {
    return post<ApiResponse<Story>>('/stories', data);
  },
  /** POST /api/stories/:id/retry-generate-chapters */
  retryGenerateChapters(id: number) {
    return post<ApiResponse<{ message: string }>>(
      `/stories/${id}/retry-generate-chapters`,
    );
  },
  /** PATCH /api/stories/:id */
  updateStory(id: number, data: StoryPayload) {
    return patch<ApiResponse<Story>>(`/stories/${id}`, data);
  },
  /** DELETE /api/stories/:id */
  deleteStory(id: number) {
    return del<ApiResponse<Story>>(`/stories/${id}`);
  },
};
