import { Form, Input, Modal, message } from 'antd';
import { useEffect, useState } from 'react';
import { storyApi } from '../../../api/story';
import type { Story } from '../../../types/story';

export type AddStoryDialogProps = {
  open: boolean;
  /** 传入时为编辑模式，不传为新增模式 */
  story?: Story | null;
  onCancel: () => void;
  /** 提交成功后的回调；新增时传入创建的故事 id */
  onSuccess: (createdStoryId?: number) => void;
};

type FormValues = {
  title: string;
  outline: string;
};

const AddStoryDialog: React.FC<AddStoryDialogProps> = ({
  open,
  story,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(story?.id);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (story) {
      console.log('-story-', story)
      setTimeout(() => {
        form.setFieldsValue({
          title: story.title,
          outline: story.outline,
        });
      });
    } else {
      form.resetFields();
    }
  }, [open, story, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (isEdit && story?.id) {
        await storyApi.updateStory(story.id, values);
        message.success('更新成功');
        onSuccess();
      } else {
        const res = await storyApi.createStory(values);
        message.success('创建成功，章节目录正在后台生成，请稍候');
        if (res.code === 0 && res.data?.id) {
          onSuccess(res.data.id);
        } else {
          onSuccess();
        }
      }
    } catch (error) {
      const isValidationError =
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error;
      if (!isValidationError) {
        message.error(isEdit ? '更新故事失败' : '新增故事失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑故事' : '新增故事'}
      open={open}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      confirmLoading={submitting}
      destroyOnHidden
      okText="提交"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="故事名称"
          name="title"
          rules={[{ required: true, message: '请输入故事名称' }]}
        >
          <Input placeholder="请输入标题" maxLength={200} showCount />
        </Form.Item>
        <Form.Item label="大纲" name="outline">
          <Input.TextArea
            placeholder="可填写故事大纲或梗概"
            rows={5}
            maxLength={10000}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddStoryDialog;
