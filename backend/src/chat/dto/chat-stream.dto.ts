import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'], example: 'user' })
  @IsIn(['user', 'assistant', 'system'], { message: 'role 不合法' })
  role!: 'user' | 'assistant' | 'system';

  @ApiProperty({ description: '消息内容', example: '你好' })
  @IsString()
  @IsNotEmpty({ message: '消息内容不能为空' })
  @MaxLength(20000, { message: '单条消息最多 20000 字' })
  content!: string;
}

export class ChatStreamDto {
  @ApiProperty({ type: [ChatMessageDto], description: '对话历史（含本轮用户消息）' })
  @IsArray()
  @ArrayMinSize(1, { message: '至少包含一条消息' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}
