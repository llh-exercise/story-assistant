import './index.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import { storyApi } from '../../../api/story';
import { Story, StoryGenerationStatus } from '../../../types/story';
import { ApiResponse } from '../../../types/request';
import { useParams } from 'react-router-dom';
import { Button, Modal, message, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import Chapter from './chapter/index';
import Write from './write/index';
import Juan from './juan/index';

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

const isGeneratingStatus = (status?: StoryGenerationStatus) =>
  status === 'pending' || status === 'running';

const StoryPage: React.FC = () => {
  const [storyTitle, setStoryName] = useState<string>('');
  const [generationStatus, setGenerationStatus] =
    useState<StoryGenerationStatus>('idle');
  const [retrying, setRetrying] = useState(false);
  const id = Number(useParams().id);
  const [chapterId, setChapterId] = useState<number>(0);
  const [isVolume, setIsVolume] = useState(false);
  /** 避免同一进度文案重复弹窗 */
  const lastProgressMessageRef = useRef('');

  const loadStory = useCallback(async () => {
    const story: ApiResponse<Story> = await storyApi.getStoryById(id);
    if (story.code === 0 && story.data) {
      setStoryName(story.data.title);
      setGenerationStatus(story.data.generationStatus ?? 'idle');
    }
  }, [id]);

  useEffect(() => {
    void loadStory();
  }, [loadStory]);

  /** 生成中轮询状态，有新进度文案时 message 提示 */
  useEffect(() => {
    if (!isGeneratingStatus(generationStatus)) {
      lastProgressMessageRef.current = '';
      return;
    }

    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await storyApi.getGenerationStatus(id);
          if (res.code === 0 && res.data) {
            setGenerationStatus(res.data.status);
            const progressMsg = res.data.message?.trim();
            if (progressMsg && progressMsg !== lastProgressMessageRef.current) {
              lastProgressMessageRef.current = progressMsg;
              message.info(progressMsg);
            }
          }
        } catch (error) {
          console.error(error);
        }
      })();
    }, 3000);

    return () => clearInterval(timer);
  }, [id, generationStatus]);

  const handleRetryGenerate = () => {
    Modal.confirm({
      title: '重新生成章节目录',
      content: '将清空当前已有目录并从头重新生成，确定继续吗？',
      okText: '重新生成',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRetrying(true);
          await storyApi.retryGenerateChapters(id);
          lastProgressMessageRef.current = '';
          setGenerationStatus('pending');
          message.success('已开始重新生成章节目录');
        } catch (error) {
          console.error(error);
          message.error('重新生成失败，请稍后重试');
        } finally {
          setRetrying(false);
        }
      },
    });
  };

  const handleChapterClick = useCallback((selectedId: number, volume: boolean) => {
    setChapterId(selectedId);
    setIsVolume(volume);
  }, []);

  const isGenerating = isGeneratingStatus(generationStatus);

  const renderCenter = () => {
    if (!chapterId) {
      return null;
    }
    if (isVolume) {
      return <Juan chapterId={chapterId} isGenerating={isGenerating} />;
    }
    return <Write chapterId={chapterId} isGenerating={isGenerating} />;
  };

  const statusMeta = GENERATION_STATUS_META[generationStatus];

  return (
    <div className="story-write-page">
      <div className="story-page-left">
        <div className="story-page-left-top">
          <span className="story-page-left-top__title" title={storyTitle}>
            {storyTitle}
          </span>
          {statusMeta ? (
            <Tag color={statusMeta.color}>{statusMeta.text}</Tag>
          ) : null}
          {generationStatus === 'failed' ? (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              loading={retrying}
              onClick={handleRetryGenerate}
            >
              重新生成
            </Button>
          ) : null}
        </div>
        <div className="story-page-left-content">
          <Chapter
            onChapterClick={handleChapterClick}
            isGenerating={isGenerating}
          />
        </div>
      </div>
      <div className="story-page-center">{renderCenter()}</div>
      <div className="story-page-right">right</div>
    </div>
  );
};

export default StoryPage;
