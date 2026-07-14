import './index.css';
import { Input, Button, message } from 'antd';
import { useState, useEffect, useRef } from 'react';
import { chapterApi } from '../../../../api/chapter';
import { ApiResponse } from '../../../../types/request';
import type { Chapter } from '../../../../types/chapter';
import type { GetRef } from 'antd';

const { TextArea } = Input;
type ContentTextAreaRef = GetRef<typeof TextArea>;

interface WriteProps {
  chapterId: number;
  /** 目录正在生成时隐藏操作按钮 */
  isGenerating?: boolean;
}

/** 章节点：细纲 + 正文 + 生成/保存 */
const Write: React.FC<WriteProps> = ({ chapterId, isGenerating = false }) => {
  const [outline, setOutline] = useState('');
  const [content, setContent] = useState('');

  const loadChapter = async () => {
    const res: ApiResponse<Chapter> = await chapterApi.getChapterById(chapterId);
    if (res.code === 0 && res.data) {
      setOutline(res.data.outline);
      setContent(res.data.content);
    }
  };

  useEffect(() => {
    void loadChapter();
  }, [chapterId]);

  const handleSaveOutline = async () => {
    await chapterApi.updateChapter(chapterId, { outline });
    message.success('保存细纲成功');
  };

  const handleSaveContent = async () => {
    await chapterApi.updateChapter(chapterId, { content });
    message.success('保存内容成功');
  };

  const handleGenerateContent = async () => {
    setContent('');
    await chapterApi.generateChapterContentStream(chapterId, outline, (text) => {
      setContent((prev) => prev + text);
    });
  };

  const contentRef = useRef<ContentTextAreaRef>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const scrollToBottom = () => {
    const el = contentRef.current?.resizableTextArea?.textArea;
    if (!el || !shouldAutoScrollRef.current) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [content]);

  return (
    <div className="story-write">
      <div className="story-write-top">
        <TextArea
          className="story-write-textarea"
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          placeholder="本章细纲"
          maxLength={2000}
          showCount
        />
      </div>
      {!isGenerating ? (
        <div className="story-write-middle">
          <Button type="primary" onClick={handleSaveOutline}>
            保存细纲
          </Button>
          <div className="story-write-middle-buttons">
            <Button type="primary" onClick={handleGenerateContent}>
              根据细纲生成内容
            </Button>
            <Button type="primary" onClick={handleSaveContent}>
              保存内容
            </Button>
          </div>
        </div>
      ) : null}
      <div className="story-write-content">
        <TextArea
          className="story-write-textarea"
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="本章内容"
          maxLength={5000}
          showCount
        />
      </div>
    </div>
  );
};

export default Write;
