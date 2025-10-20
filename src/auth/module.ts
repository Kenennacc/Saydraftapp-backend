import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session, Token, User } from 'src/entities';
import { MailModule } from 'src/mail/module';
import { SubscriptionModule } from 'src/subscription/module';
import AuthController from './controller';
import AuthService from './service';

@Module({
  imports: [
    MailModule,
    forwardRef(() => SubscriptionModule),
    TypeOrmModule.forFeature([User, Token, Session]),
    BullModule.registerQueue({
      name: 'contract',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
