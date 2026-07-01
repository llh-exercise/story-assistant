import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @ApiOperation({ summary: '获取故事列表' })
  findAll() {
    return this.storiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取故事详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.storiesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建故事' })
  create(@Body() dto: CreateStoryDto) {
    return this.storiesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新故事' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStoryDto,
  ) {
    return this.storiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除故事' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.storiesService.remove(id);
  }
}
