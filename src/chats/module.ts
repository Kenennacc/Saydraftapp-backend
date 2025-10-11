import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/module';
import { Chat, File, Message, PendingInvitation } from 'src/entities';
import Prompt from 'src/entities/Prompts';
import State from 'src/entities/State';
import { MailModule } from 'src/mail/module';
import AIService from 'src/services/AI';
import { S3Service } from 'src/services/S3';
import ChatsController from './controller';
import ContractProcessor from './processor';
import ChatsService from './service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    TypeOrmModule.forFeature([
      Chat,
      Prompt,
      Message,
      File,
      State,
      PendingInvitation,
    ]),
    BullModule.registerQueue({
      name: 'contract',
    }),
    BullModule.registerQueue({
      name: 'mail',
    }),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, S3Service, AIService, ContractProcessor],
  exports: [BullModule],
})
export class ChatsModule {}
