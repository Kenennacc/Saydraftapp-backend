import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/module';
import { Chat, File, Message } from 'src/entities';
import Prompt from 'src/entities/Prompts';
import State from 'src/entities/State';
import AIService from 'src/services/AI';
import { S3Service } from 'src/services/S3';
import ChatsController from './controller';
import ChatsService from './service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Chat, Prompt, Message, File, State]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, S3Service, AIService],
})
export class ChatsModule {}
