import { del, get, patch, post } from './request';
import type { Story } from '../types/story';
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
  /** POST /api/stories */
  createStory(data: StoryPayload) {
    return post<ApiResponse<Story>>('/stories', data);
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
