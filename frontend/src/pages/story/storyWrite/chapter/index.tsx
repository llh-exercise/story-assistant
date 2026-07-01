import './index.css';
import { Tree } from 'antd';
import type { TreeDataNode } from 'antd';
import { ProductOutlined } from '@ant-design/icons';
import { chapterApi } from '../../../../api/chapter';
import { ApiResponse } from '../../../../types/request';
import type { Chapter } from '../../../../types/chapter';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface ChapterNode extends TreeDataNode {
    title: string;
    isLeaf: boolean;
    children?: ChapterNode[];
}

type ChapterProps = {
    onChapterClick: (chapterId: number, isVolume: boolean) => void;
}

const Chapter: React.FC<ChapterProps> = ({ onChapterClick }) => {
    const [chapterList, setChapterList] = useState<ChapterNode[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const storyId = Number(useParams().id);

    const selectNode = (treeData: ChapterNode[], key: string) => {
        setSelectedKeys([key]);
        const isVolume = treeData.some((volume) => String(volume.key) === key);
        onChapterClick(Number(key), isVolume);
    };

    /**
     * 加载章节列表
     */
    const loadChapterList = async () => {
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

            if (treeData.length > 0) {
                const selectedKey = String(treeData[0].key);
                selectNode(treeData, selectedKey);
                onChapterClick(Number(selectedKey), true);
            }
        }
    };

    useEffect(() => {
        void loadChapterList();
    }, [storyId]);

    /**
     * 渲染章节节点标题
     */
    const renderNodeTitle = (node: ChapterNode) => {
        return (
            <div className="chapter-node-title">
                <span className="chapter-node-title__text" title={node.title}>
                    {node.title}
                </span>
                <span
                    className="chapter-node-title__btn"
                    onClick={(e) => e.stopPropagation()}
                    >
                    {/* <ProductOutlined /> */}
                </span>
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
        </div>
  );
};

export default Chapter;