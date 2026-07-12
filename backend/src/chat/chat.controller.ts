import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { ChatService } from './chat.service';
import { ChatStreamDto } from './dto/chat-stream.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('stream')
  @ApiOperation({ summary: '大模型多轮对话（流式）' })
  async stream(
    @Body() dto: ChatStreamDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const result = await this.chatService.stream(dto);

    reply.raw.setHeader('Content-Type', 'text/plain; charset=utf-8');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no');

    try {
      for await (const chunk of result.textStream) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
    } catch (error) {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
      throw error;
    }
  }
}
