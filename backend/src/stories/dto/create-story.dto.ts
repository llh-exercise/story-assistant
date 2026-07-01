import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStoryDto {
  @ApiProperty({ description: '标题', example: '我的第一个故事' })
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(100, { message: '标题最多100个字符' })
  title!: string;

  @ApiProperty({ description: '大纲', example: '这是一个精彩的故事大纲...' })
  @IsString()
  @IsNotEmpty({ message: '大纲不能为空' })
  @MaxLength(2000, { message: '大纲最多2000个字符' })
  outline!: string;
}
