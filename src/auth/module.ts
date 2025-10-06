import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session, Token, User } from 'src/entities';
import { MailModule } from 'src/mail/module';
import AuthController from './controller';
import AuthService from './service';

@Module({
  imports: [MailModule, TypeOrmModule.forFeature([User, Token, Session])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
