import './index.css';
import { useState, useEffect } from 'react';
import { storyApi } from '../../../api/story';
import { Story } from '../../../types/story';
import { ApiResponse } from '../../../types/request';
import { useParams } from 'react-router-dom';

import Chapter from './chapter/index';
import Write from './write/index';
import Juan from './juan/index';

const StoryPage: React.FC = () => {
  const [storyTitle, setStoryName] = useState<string>('');
  const id = Number(useParams().id);
  const [chapterId, setChapterId] = useState<number>(0);
  const [isVolume, setIsVolume] = useState(false);

  const loadStory = async () => {
    const story: ApiResponse<Story> = await storyApi.getStoryById(id);
    if (story.code == 0 && story.data) {
      setStoryName(story.data.title);
    }
  };

  useEffect(() => {
    void loadStory();
  }, [id]);

  const handleChapterClick = (selectedId: number, volume: boolean) => {
    setChapterId(selectedId);
    setIsVolume(volume);
  };

  const renderCenter = () => {
    if (!chapterId) {
      return null;
    }
    if (isVolume) {
      return <Juan chapterId={chapterId} />;
    }
    return <Write chapterId={chapterId} />;
  };

  return (
    <div className="story-write-page">
      <div className="story-page-left">
        <div className="story-page-left-top">{storyTitle}</div>
        <div className="story-page-left-content">
          <Chapter onChapterClick={handleChapterClick} />
        </div>
      </div>
      <div className="story-page-center">{renderCenter()}</div>
      <div className="story-page-right">right</div>
    </div>
  );
};

export default StoryPage;
