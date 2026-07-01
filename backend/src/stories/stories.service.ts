import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { DeepSeekService } from '../ai/deepseek.service';

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService, private readonly deepSeekService: DeepSeekService) {}

  findAll() {
    return this.prisma.story.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const story = await this.prisma.story.findUnique({ where: { id } });
    if (!story) {
      throw new NotFoundException(`故事 #${id} 不存在`);
    }
    return story;
  }

  async create(dto: CreateStoryDto) {
    const story = await this.prisma.story.create({
      data: {
        title: dto.title,
        outline: dto.outline,
      },
    });

    await this.deepSeekService.generateChapterList(
      story.id,
      dto.title,
      dto.outline,
    );

    return story;
  }

  async update(id: number, dto: UpdateStoryDto) {
    await this.findOne(id);
    return this.prisma.story.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.story.delete({ where: { id } });
  }
}
