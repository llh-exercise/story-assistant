import { Form, Input, Modal, message } from 'antd';
import { useEffect, useState } from 'react';
import { chapterApi } from '../../../../api/chapter';

/** 新增类型：卷（无 parentId）或章（需 parentId / afterId） */
export type AddChapterType = 'volume' | 'chapter';

export type AddChapterDialogProps = {
  open: boolean;
  storyId: number;
  /** volume = 卷；chapter = 章 */
  type: AddChapterType;
  /** 插在该同级节点之后（与当前点击节点同级） */
  afterId: number;
  onCancel: () => void;
  /** 创建成功后回调，可带回新建节点 id */
  onSuccess: (createdId?: number) => void;
};

type FormValues = {
  title: string;
};

const AddChapterDialog: React.FC<AddChapterDialogProps> = ({
  open,
  storyId,
  type,
  afterId,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const isVolume = type === 'volume';

  useEffect(() => {
    if (!open) {
      return;
    }
    form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      if (!afterId || afterId <= 0) {
        message.error('缺少参照节点，无法插入');
        return;
      }

      setSubmitting(true);

      // 后端 CreateChapterDto 要求 outline 非空；afterId 会自动对齐父级并腾位
      const res = await chapterApi.createChapter({
        storyId,
        title: values.title.trim(),
        outline: '暂无',
        afterId,
      });

      if (res.code === 0) {
        message.success(isVolume ? '新增卷成功' : '新增章节成功');
        onSuccess(res.data?.id);
      } else {
        message.error(res.msg || (isVolume ? '新增卷失败' : '新增章节失败'));
      }
    } catch (error) {
      const isValidationError =
        typeof error === 'object' &&
        error !== null &&
        'errorFields' in error;
      if (!isValidationError) {
        message.error(isVolume ? '新增卷失败' : '新增章节失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isVolume ? '新增卷' : '新增章节'}
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

export default AddChapterDialog;
