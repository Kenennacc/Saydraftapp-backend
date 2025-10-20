import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/module';
import { Subscription, Usage, User } from 'src/entities';
import { StripeService } from 'src/services/Stripe';
import { SubscriptionService } from 'src/services/Subscription';
import SubscriptionController from './controller';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    TypeOrmModule.forFeature([Subscription, Usage, User])
  ],
  controllers: [SubscriptionController],
  providers: [StripeService, SubscriptionService],
  exports: [SubscriptionService, StripeService],
})
export class SubscriptionModule {}
