import { Module } from '@nestjs/common';
import { DeepSeekService } from './deepseek.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DeepSeekService],
  exports: [DeepSeekService],
})
export class AiModule {}