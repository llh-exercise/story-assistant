import './index.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Card, Modal, message } from 'antd';
import { Story } from '../../../types/story';
import AddStoryDialog from './addStoryDialog';
import { storyApi } from '../../../api/story';
import { ApiResponse } from '../../../types/request';

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

  const loadList = async () => {
    try {
      const res: ApiResponse<Story[]> = await storyApi.getList();
      if (res.code === 0 && res.data) {
        setStoryList(res.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void loadList();
  }, []);

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
          {storyList.map((story) => (
            <Card
              key={story.id}
              className="story-item"
              title={story.title}
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
          ))}
          <div className="story-item story-item-add" onClick={() => handleStoryAdd()}>
            <PlusOutlined className="story-item-add-icon" />
          </div>
        </div>
      </div>

      <AddStoryDialog
        open={dialogOpen}
        story={editingStory}
        onCancel={handleDialogClose}
        onSuccess={() => {
          handleDialogClose();
          void loadList();
        }}
      />
    </>
  );
};

export default StoryListPage;
