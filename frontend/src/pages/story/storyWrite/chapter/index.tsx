import './index.css';
import { Tree, message, Modal } from 'antd';
import type { TreeDataNode } from 'antd';
import {
    EditOutlined,
    PlusOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { chapterApi } from '../../../../api/chapter';
import { ApiResponse } from '../../../../types/request';
import type { Chapter } from '../../../../types/chapter';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ChapterEditDialog from './chapterEditDialog';
import AddChapterDialog, { type AddChapterType } from './addChapterDialog';

interface ChapterNode extends TreeDataNode {
    title: string;
    isLeaf: boolean;
    children?: ChapterNode[];
}

type EditingChapter = {
    id: number;
    title: string;
    isVolume: boolean;
};

type AddingChapter = {
    type: AddChapterType;
    afterId: number;
};

type ChapterProps = {
    onChapterClick: (chapterId: number, isVolume: boolean) => void;
    /** 目录正在生成时隐藏节点操作按钮，并轮询刷新列表 */
    isGenerating?: boolean;
}

const Chapter: React.FC<ChapterProps> = ({ onChapterClick, isGenerating = false }) => {
    const [chapterList, setChapterList] = useState<ChapterNode[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [editOpen, setEditOpen] = useState(false);
    const [editingChapter, setEditingChapter] = useState<EditingChapter | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addingChapter, setAddingChapter] = useState<AddingChapter | null>(null);
    const storyId = Number(useParams().id);
    /** 上一轮是否在生成，用于判断生成结束时再拉一次最终列表 */
    const prevIsGeneratingRef = useRef(false);

    const selectNode = (treeData: ChapterNode[], key: string) => {
        setSelectedKeys([key]);
        const isVolume = treeData.some((volume) => String(volume.key) === key);
        onChapterClick(Number(key), isVolume);
    };

    /**
     * 加载章节列表
     */
    const loadChapterList = useCallback(async (autoSelectFirst = true) => {
        const res: ApiResponse<Chapter[]> = await chapterApi.getList(storyId);
        if (res.code === 0 && res.data) {
            const treeData: ChapterNode[] = res.data.map((volume) => ({
                key: String(volume.id),
                title: volume.title,
                isLeaf: false,
                children: (volume.children ?? []).map((chapter) => ({
                    key: String(chapter.id),
                    title: chapter.title,
                    isLeaf: true,
                })),
            }));

            setChapterList(treeData);

            if (autoSelectFirst && treeData.length > 0) {
                const selectedKey = String(treeData[0].key);
                selectNode(treeData, selectedKey);
                onChapterClick(Number(selectedKey), true);
            }
        }
    }, [storyId]);

    useEffect(() => {
        void loadChapterList();
    }, [loadChapterList]);

    /** 根据父级 isGenerating 刷新目录树，不再单独查生成状态 */
    useEffect(() => {
        const wasGenerating = prevIsGeneratingRef.current;
        prevIsGeneratingRef.current = isGenerating;

        if (isGenerating) {
            if (!wasGenerating) {
                message.info('正在生成章节，列表自动刷新中...');
            }
            void loadChapterList(false);

            const timer = setInterval(() => {
                void loadChapterList(false);
            }, 3000);

            return () => clearInterval(timer);
        }

        // 从生成中变为结束时再拉一次最终列表
        if (wasGenerating) {
            void loadChapterList(false);
        }
    }, [isGenerating, loadChapterList]);

    /** 打开编辑名称弹窗 */
    const handleEditClick = (
        e: React.MouseEvent,
        node: ChapterNode,
    ) => {
        e.stopPropagation();
        setEditingChapter({
            id: Number(node.key),
            title: node.title,
            isVolume: !node.isLeaf,
        });
        setEditOpen(true);
    };

    const handleEditCancel = () => {
        setEditOpen(false);
        setEditingChapter(null);
    };

    const handleEditSuccess = () => {
        handleEditCancel();
        void loadChapterList(false);
    };

    /** 在当前节点后插入同级卷/章 */
    const handleAddClick = (
        e: React.MouseEvent,
        node: ChapterNode,
    ) => {
        e.stopPropagation();
        setAddingChapter({
            type: node.isLeaf ? 'chapter' : 'volume',
            afterId: Number(node.key),
        });
        setAddOpen(true);
    };

    const handleAddCancel = () => {
        setAddOpen(false);
        setAddingChapter(null);
    };

    const handleAddSuccess = () => {
        handleAddCancel();
        void loadChapterList(false);
    };

    /** 删除卷或章节（先确认） */
    const handleDeleteClick = (
        e: React.MouseEvent,
        node: ChapterNode,
    ) => {
        e.stopPropagation();

        const id = Number(node.key);
        const isVolume = !node.isLeaf;
        const title = node.title;

        Modal.confirm({
            title: isVolume ? '确认删除该卷' : '确认删除该章节',
            content: isVolume
                ? `删除「${title}」后，其下所有章节也会一并删除，确定继续吗？`
                : `确定删除「${title}」吗？删除后无法恢复。`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await chapterApi.deleteChapter(id);
                    message.success(isVolume ? '卷已删除' : '章节已删除');

                    const wasSelected = selectedKeys.some(
                        (key) => String(key) === String(id),
                    );
                    await loadChapterList(false);

                    // 删除的是当前选中项时，清空中间编辑区
                    if (wasSelected) {
                        setSelectedKeys([]);
                        onChapterClick(0, false);
                    }
                } catch (error) {
                    console.error(error);
                    message.error(isVolume ? '删除卷失败' : '删除章节失败');
                }
            },
        });
    };

    /**
     * 渲染章节节点标题
     */
    const renderNodeTitle = (node: ChapterNode) => {
        return (
            <div className="chapter-node-title">
                <span className="chapter-node-title__text" title={node.title}>
                    {node.title}
                </span>
                {!isGenerating ? (
                    <span className="chapter-node-title__actions">
                        <span
                            className="chapter-node-title__btn"
                            title="编辑"
                            onClick={(e) => handleEditClick(e, node)}
                        >
                            <EditOutlined />
                        </span>
                        <span
                            className="chapter-node-title__btn"
                            title="添加"
                            onClick={(e) => handleAddClick(e, node)}
                        >
                            <PlusOutlined />
                        </span>
                        <span
                            className="chapter-node-title__btn"
                            title="删除"
                            onClick={(e) => handleDeleteClick(e, node)}
                        >
                            <DeleteOutlined />
                        </span>
                    </span>
                ) : null}
            </div>
        );
    };

    /**
     * 点击章节，设置当前选中的章节id
     */
    const handleChapterSelect = (keys: React.Key[]) => {
        if (keys.length === 0) {
            return;
        }
        setSelectedKeys(keys);
        const selectedKey = String(keys[0]);
        const isVolume = chapterList.some((volume) => String(volume.key) === selectedKey);
        onChapterClick(Number(selectedKey), isVolume);
    };

    return (
        <div className="chapter-list">
            <Tree
                key={chapterList.length > 0 ? `tree-${storyId}` : 'empty'}
                motion={false}
                defaultExpandAll
                selectedKeys={selectedKeys}
                treeData={chapterList}
                titleRender={renderNodeTitle}
                onSelect={handleChapterSelect}
            />
            {editingChapter ? (
                <ChapterEditDialog
                    open={editOpen}
                    chapterId={editingChapter.id}
                    title={editingChapter.title}
                    isVolume={editingChapter.isVolume}
                    onCancel={handleEditCancel}
                    onSuccess={handleEditSuccess}
                />
            ) : null}
            {addingChapter ? (
                <AddChapterDialog
                    open={addOpen}
                    storyId={storyId}
                    type={addingChapter.type}
                    afterId={addingChapter.afterId}
                    onCancel={handleAddCancel}
                    onSuccess={handleAddSuccess}
                />
            ) : null}
        </div>
  );
};

export default Chapter;