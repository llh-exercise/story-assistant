export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

export interface Story {
  id: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryPayload {
  title: string;
  content: string;
  author?: string;
}

export type UpdateStoryPayload = Partial<CreateStoryPayload>;
