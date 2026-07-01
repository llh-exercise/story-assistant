export interface Chapter {
  id?: number;
  storyId: number;
  parentId?: number | null;
  title: string;
  outline: string;
  content: string;
  /** [2026-06-29] 同级排序，越小越靠前 */
  sortOrder?: number;
  children?: Chapter[];
  createdAt?: string;
  updatedAt?: string;
}
