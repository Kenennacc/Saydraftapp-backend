import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription, User } from 'src/entities';
import { AuthModule } from 'src/auth/module';
import AdminController from './controller';
import AdminService from './service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Subscription]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
