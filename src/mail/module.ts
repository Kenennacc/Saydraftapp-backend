import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import MailProcessor from './processor';
import MailService from './service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'mail',
    }),
  ],
  providers: [MailService, MailProcessor],
  exports: [BullModule, MailService],
})
export class MailModule {}
