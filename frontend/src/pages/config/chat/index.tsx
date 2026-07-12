import './index.css';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Spin, message } from 'antd';
import { ClearOutlined, SendOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { chatApi, type ChatMessage } from '../../../api/chat';

type UiMessage = ChatMessage & {
  id: string;
  pending?: boolean;
};

const { TextArea } = Input;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleClear = () => {
    if (sending) {
      abortRef.current?.abort();
      setSending(false);
    }
    setMessages([]);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) {
      return;
    }

    const userMsg: UiMessage = {
      id: createId(),
      role: 'user',
      content,
    };
    const assistantId = createId();
    const assistantMsg: UiMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      pending: true,
    };

    const nextHistory: ChatMessage[] = [
      ...messages.map(({ role, content: text }) => ({ role, content: text })),
      { role: 'user', content },
    ];

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await chatApi.streamChat(
        nextHistory,
        (chunk) => {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + chunk, pending: true }
                : item,
            ),
          );
        },
        controller.signal,
      );

      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId ? { ...item, pending: false } : item,
        ),
      );

      console.log('messages', messages);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error(error);
      message.error(error instanceof Error ? error.message : '对话失败');
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                pending: false,
                content: item.content || '（生成失败）',
              }
            : item,
        ),
      );
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const renderMessageContent = (item: UiMessage) => {
    if (!item.content) {
      return item.pending ? <Spin size="small" /> : null;
    }

    // 用户消息保持纯文本；助手消息按 Markdown 渲染
    if (item.role === 'user') {
      return item.content;
    }

    return <ReactMarkdown>{item.content}</ReactMarkdown>;
  };

  return (
    <div className="config-chat">
      <div className="config-chat__header">
        <div>
          <div className="config-chat__title">大模型对话</div>
          <div className="config-chat__desc">
            助手回复按 Markdown 渲染（一、二、三 + 1.2.3 + **加粗**）
          </div>
        </div>
        <Button
          icon={<ClearOutlined />}
          onClick={handleClear}
          disabled={!messages.length && !sending}
        >
          清空
        </Button>
      </div>

      <div className="config-chat__list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="config-chat__empty">输入消息开始对话</div>
        ) : (
          messages.map((item) => (
            <div
              key={item.id}
              className={`config-chat__bubble config-chat__bubble--${item.role}`}
            >
              <div className="config-chat__role">
                {item.role === 'user' ? '你' : '助手'}
              </div>
              <div
                className={
                  item.role === 'assistant'
                    ? 'config-chat__content config-chat__content--markdown'
                    : 'config-chat__content'
                }
              >
                {renderMessageContent(item)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="config-chat__composer">
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          autoSize={{ minRows: 2, maxRows: 6 }}
          disabled={sending}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={sending}
          onClick={() => void handleSend()}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;
