/** 章节目录后台生成状态 */
export type StoryGenerationStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'done'
  | 'failed';

export interface Story {
  id?: number;
  title: string;
  outline: string;
  generationStatus?: StoryGenerationStatus;
  createdAt?: string;
  updatedAt?: string;
}
