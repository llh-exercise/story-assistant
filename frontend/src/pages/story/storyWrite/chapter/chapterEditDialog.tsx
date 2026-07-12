import { Form, Input, Modal, message } from 'antd';
import { useEffect, useState } from 'react';
import { chapterApi } from '../../../../api/chapter';

export type ChapterEditDialogProps = {
  open: boolean;
  /** 被编辑节点 id */
  chapterId: number;
  /** 当前名称，用于回填 */
  title: string;
  /** 是否为卷（仅影响文案） */
  isVolume?: boolean;
  onCancel: () => void;
  onSuccess: () => void;
};

type FormValues = {
  title: string;
};

const ChapterEditDialog: React.FC<ChapterEditDialogProps> = ({
  open,
  chapterId,
  title,
  isVolume = false,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    // destroyOnHidden 后需延后回填，避免 form 未就绪
    setTimeout(() => {
      form.setFieldsValue({ title });
    });
  }, [open, title, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const res = await chapterApi.updateChapter(chapterId, {
        title: values.title.trim(),
      });

      if (res.code === 0) {
        message.success(isVolume ? '卷名称已更新' : '章节名称已更新');
        onSuccess();
      } else {
        message.error(res.msg || '更新失败');
      }
    } catch (error) {
      const isValidationError =
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error;
      if (!isValidationError) {
        message.error(isVolume ? '更新卷名称失败' : '更新章节名称失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isVolume ? '编辑卷名称' : '编辑章节名称'}
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
          label={isVolume ? '卷名称' : '章节名称'}
          name="title"
          rules={[{ required: true, message: isVolume ? '请输入卷名称' : '请输入章节名称' }]}
        >
          <Input
            placeholder={isVolume ? '请输入卷名称' : '请输入章节名称'}
            maxLength={100}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChapterEditDialog;
