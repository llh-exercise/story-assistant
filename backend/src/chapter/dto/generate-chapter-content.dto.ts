import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
/** 根据细纲流式生成正文 */
export class GenerateChapterContentDto {
  @ApiPropertyOptional({
    description: '本章细纲（不传则用数据库中的 outline）',
    example: '主角在雨夜遇见神秘人...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outline?: string;
}