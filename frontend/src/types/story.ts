/** 章节目录后台生成状态 */
export type StoryGenerationStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'done'
  | 'failed';

/** 目录生成状态轮询结果 */
export interface StoryGenerationStatusPayload {
  status: StoryGenerationStatus;
  message: string;
}

export interface Story {
  id?: number;
  title: string;
  outline: string;
  generationStatus?: StoryGenerationStatus;
  /** 目录生成进度文案 */
  generationMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}
