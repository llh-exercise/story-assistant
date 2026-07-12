import { Injectable } from '@nestjs/common';
import { DeepSeekService } from '../ai/deepseek.service';
import { ChatStreamDto } from './dto/chat-stream.dto';
import { ChapterContentStreamResult } from '../ai/deepseek.service';

@Injectable()
export class ChatService {
  constructor(private readonly deepSeekService: DeepSeekService) {}

  stream(dto: ChatStreamDto): Promise<ChapterContentStreamResult> {
    return this.deepSeekService.streamChat(dto.messages);
  }
}
