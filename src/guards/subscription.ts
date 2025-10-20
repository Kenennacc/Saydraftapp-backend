import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { SubscriptionService } from 'src/services/Subscription';
import { User as UserType } from 'src/types';

@Injectable()
export default class SubscriptionGuard implements CanActivate {
  constructor(private subscriptionService: SubscriptionService) {}

  async canActivate(context: ExecutionContext) {
    console.log('=== SUBSCRIPTION GUARD DEBUG ===');
    
    const request = context.switchToHttp().getRequest<{ user: UserType }>();
    const user = request.user;

    console.log('User in subscription guard:', user?.id);

    if (!user) {
      console.log('No user found in request');
      throw new ForbiddenException('User not authenticated');
    }

    console.log('Checking if user can create chat...');
    const canCreateChat = await this.subscriptionService.canCreateChat(user.id, user.isAdmin);
    
    console.log('Can create chat result:', canCreateChat);
    
    if (!canCreateChat) {
      console.log('User cannot create chat - blocking request');
      throw new ForbiddenException(
        'You have reached your daily chat limit. Upgrade to continue creating contracts.',
      );
    }

    console.log('Subscription guard passed - allowing chat creation');
    console.log('=== END SUBSCRIPTION GUARD DEBUG ===');
    return true;
  }
}
