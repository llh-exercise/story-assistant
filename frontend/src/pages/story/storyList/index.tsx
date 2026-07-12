import './index.css';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Card, Modal, message, Tag } from 'antd';
import { Story, StoryGenerationStatus } from '../../../types/story';
import AddStoryDialog from './addStoryDialog';
import { storyApi } from '../../../api/story';
import { ApiResponse } from '../../../types/request';

const GENERATION_STATUS_META: Record<
  StoryGenerationStatus,
  { text: string; color: string } | null
> = {
  idle: null,
  pending: { text: '等待生成', color: 'default' },
  running: { text: '目录生成中', color: 'processing' },
  done: null,
  failed: { text: '生成失败', color: 'error' },
};

const StoryListPage: React.FC = () => {
  const navigate = useNavigate();

  const [storyList, setStoryList] = useState<Story[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  const handleStoryClick = (id: number) => {
    navigate(`/story/${id}`);
  };

  const handleStoryAdd = () => {
    setEditingStory(null);
    setDialogOpen(true);
  };

  const loadList = useCallback(async () => {
    try {
      const res: ApiResponse<Story[]> = await storyApi.getList();
      if (res.code === 0 && res.data) {
        setStoryList(res.data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const removeStory = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该故事吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await storyApi.deleteStory(id);
          message.success('删除成功');
          await loadList();
        } catch (error) {
          console.error(error);
        }
      },
    });
  };

  const editStory = (id: number) => {
    const story = storyList.find((item) => item.id === id);
    if (!story) {
      return;
    }
    setEditingStory(story);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingStory(null);
  };

  return (
    <>
      <div className="story-page">
        <div className="story-list">
          {storyList.map((story) => {
            const statusMeta = story.generationStatus
              ? GENERATION_STATUS_META[story.generationStatus]
              : null;

            return (
              <Card
                key={story.id}
                className="story-item"
                title={story.title}
                extra={
                  statusMeta ? (
                    <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
                  ) : null
                }
                variant="borderless"
                onClick={() => handleStoryClick(story.id!)}
                actions={[
                  <DeleteOutlined
                    key="remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStory(story.id!);
                    }}
                  />,
                  <EditOutlined
                    key="edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      editStory(story.id!);
                    }}
                  />,
                ]}
              >
                <div className="story-item-outline">{story.outline}</div>
              </Card>
            );
          })}
          <div className="story-item story-item-add" onClick={() => handleStoryAdd()}>
            <PlusOutlined className="story-item-add-icon" />
          </div>
        </div>
      </div>

      <AddStoryDialog
        open={dialogOpen}
        story={editingStory}
        onCancel={handleDialogClose}
        onSuccess={(createdStoryId) => {
          handleDialogClose();
          if (createdStoryId) {
            navigate(`/story/${createdStoryId}`);
            return;
          }else{
            void loadList();
          }
        }}
      />
    </>
  );
};

export default StoryListPage;
