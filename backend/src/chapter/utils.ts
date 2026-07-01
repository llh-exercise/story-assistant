import type { Chapter } from '@prisma/client';

export type ChapterTreeNode = {
  id: number;
  title: string;
  outline: string;
  content: string;
  /** [2026-06-29] 同级排序，供前端树展示与后续拖拽排序 */
  sortOrder: number;
  children?: ChapterTreeNode[];
};

type SortableChapter = Pick<Chapter, 'id' | 'parentId' | 'sortOrder' | 'createdAt'>;

/** [2026-06-29] 同级节点按 sortOrder 升序；相同时用 id 保证稳定顺序（兼容旧数据） */
export function compareBySortOrder(
  a: Pick<Chapter, 'sortOrder' | 'id'>,
  b: Pick<Chapter, 'sortOrder' | 'id'>,
): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return a.id - b.id;
}

/** [2026-06-29] 提取并排序所有卷（parentId 为 null） */
export function sortVolumes(chapters: Chapter[]): Chapter[] {
  return chapters
    .filter((item) => item.parentId == null)
    .sort(compareBySortOrder);
}

/** [2026-06-29] 提取并排序某卷下的所有章 */
export function sortChaptersUnderVolume(
  chapters: Chapter[],
  volumeId: number,
): Chapter[] {
  return chapters
    .filter((item) => item.parentId === volumeId)
    .sort(compareBySortOrder);
}

/** [2026-06-29] 按阅读顺序展平：卷顺序 → 卷内章顺序 */
export function flattenChaptersInReadOrder(chapters: Chapter[]): Chapter[] {
  const volumes = sortVolumes(chapters);
  return volumes.flatMap((volume) =>
    sortChaptersUnderVolume(chapters, volume.id),
  );
}

/** [2026-06-29] 将扁平章节列表转为树；卷/章均按 sortOrder 排序 */
export function convertChaptersToTree(chapters: Chapter[]): ChapterTreeNode[] {
  const volumes = sortVolumes(chapters);
  return volumes.map((root) => ({
    id: root.id,
    title: root.title,
    outline: root.outline,
    content: root.content,
    sortOrder: root.sortOrder,
    children: sortChaptersUnderVolume(chapters, root.id).map((child) => ({
      id: child.id,
      title: child.title,
      outline: child.outline,
      content: child.content,
      sortOrder: child.sortOrder,
    })),
  }));
}

/** [2026-06-29] 旧数据回填：同级 sortOrder 全为 0 时，按 createdAt + id 赋 0..n-1 */
export function buildSortOrderBackfillUpdates(
  chapters: SortableChapter[],
): Array<{ id: number; sortOrder: number }> {
  const groups = new Map<string, SortableChapter[]>();

  for (const chapter of chapters) {
    const key = chapter.parentId == null ? 'root' : String(chapter.parentId);
    const group = groups.get(key) ?? [];
    group.push(chapter);
    groups.set(key, group);
  }

  const updates: Array<{ id: number; sortOrder: number }> = [];

  for (const group of groups.values()) {
    if (group.length <= 1) {
      continue;
    }

    const allZero = group.every((item) => item.sortOrder === 0);
    if (!allZero) {
      continue;
    }

    const sorted = [...group].sort((a, b) => {
      const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return a.id - b.id;
    });

    sorted.forEach((item, index) => {
      updates.push({ id: item.id, sortOrder: index });
    });
  }

  return updates;
}
