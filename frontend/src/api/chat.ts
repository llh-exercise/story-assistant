import type { ApiResponse } from '../types/request';

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export const chatApi = {
  /**
   * POST /api/chat/stream
   * 流式多轮对话，按 chunk 回调追加文本
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!res.ok || !res.body) {
      let msg = '对话失败';
      try {
        const data = (await res.json()) as ApiResponse | { msg?: string };
        msg = ('msg' in data && data.msg) || msg;
      } catch {
        // ignore parse error
      }
      throw new Error(msg);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      onChunk(decoder.decode(value, { stream: true }));
    }
  },
};
