import {

  IsInt,

  IsNotEmpty,

  IsOptional,

  IsString,

  MaxLength,

  Min,

} from 'class-validator';

import { Type } from 'class-transformer';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';



export class CreateChapterDto {

  @ApiProperty({ description: '所属故事 ID', example: 1 })

  @Type(() => Number)

  @IsInt({ message: '故事 ID 必须为整数' })

  storyId!: number;



  /** [2026-06-29] 父节点 ID；null/不传表示卷，有值表示章 */

  @ApiPropertyOptional({ description: '父卷 ID（章必填，卷不传）', example: 1 })

  @IsOptional()

  @Type(() => Number)

  @IsInt({ message: '父卷 ID 必须为整数' })

  parentId?: number;



  @ApiProperty({ description: '章节标题', example: '第一章 开端' })

  @IsString()

  @IsNotEmpty({ message: '标题不能为空' })

  @MaxLength(100, { message: '标题最多100个字符' })

  title!: string;



  @ApiProperty({ description: '细纲', example: '主角登场，引出主线冲突...' })

  @IsString()

  @IsNotEmpty({ message: '细纲不能为空' })

  @MaxLength(2000, { message: '细纲最多2000个字符' })

  outline!: string;



  @ApiPropertyOptional({ description: '章节内容', example: '' })

  @IsOptional()

  @IsString()

  @MaxLength(50000, { message: '内容最多50000个字符' })

  content?: string;



  /** [2026-06-29] 同级排序；不传则自动追加到同级末尾 */

  @ApiPropertyOptional({ description: '同级排序（越小越靠前）', example: 0 })

  @IsOptional()

  @Type(() => Number)

  @IsInt({ message: '排序值必须为整数' })

  @Min(0, { message: '排序值不能小于 0' })

  sortOrder?: number;

}


