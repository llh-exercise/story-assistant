import './index.css';
import { Input, Button, message } from 'antd';
import { useState, useEffect } from 'react';
import { chapterApi } from '../../../../api/chapter';
import { ApiResponse } from '../../../../types/request';
import type { Chapter } from '../../../../types/chapter';

const { TextArea } = Input;

interface JuanProps {
  chapterId: number;
  /** 目录正在生成时隐藏操作按钮 */
  isGenerating?: boolean;
}

/** 卷节点：仅编辑并保存卷细纲 */
const Juan: React.FC<JuanProps> = ({ chapterId, isGenerating = false }) => {
  const [outline, setOutline] = useState('');

  const loadVolume = async () => {
    const res: ApiResponse<Chapter> = await chapterApi.getChapterById(chapterId);
    if (res.code === 0 && res.data) {
      setOutline(res.data.outline);
    }
  };

  useEffect(() => {
    void loadVolume();
  }, [chapterId]);

  const handleSaveOutline = async () => {
    await chapterApi.updateChapter(chapterId, { outline });
    message.success('保存卷细纲成功');
  };

  return (
    <div className="story-juan">
      {!isGenerating ? (
        <div className="story-juan-actions">
        <Button type="primary" onClick={handleSaveOutline}>
            保存细纲
          </Button>
        </div>
      ) : null}
      <div className="story-juan-editor">
        <TextArea
          className="story-juan-textarea"
          value={outline}
          onChange={(e) => setOutline(e.target.value)}
          placeholder="卷细纲"
          maxLength={2000}
          showCount
        />
      </div>
      
    </div>
  );
};

export default Juan;
