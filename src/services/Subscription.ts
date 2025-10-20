import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus, SubscriptionPlan, User, Usage } from 'src/entities';
import { QueryService } from 'src/services';
import { StripeService } from './Stripe';
import { addDays, isAfter } from 'date-fns';

@Injectable()
export class SubscriptionService extends QueryService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Usage)
    private usageRepository: Repository<Usage>,
    private stripeService: StripeService,
  ) {
    super();
  }

  async createFreeSubscription(userId: string) {
    const subscription = this.subscriptionRepository.create({
      user: { id: userId },
      status: SubscriptionStatus.ACTIVE,
      plan: SubscriptionPlan.FREE,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async createTrialSubscription(userId: string, customerId: string, subscriptionId: string, priceId: string) {
    const trialStart = new Date();
    const trialEnd = addDays(trialStart, 7);

    const subscription = this.subscriptionRepository.create({
      user: { id: userId },
      status: SubscriptionStatus.TRIALING,
      plan: SubscriptionPlan.PAID,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      trialStart,
      trialEnd,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async createSubscriptionFromStripe(stripeSubscription: any) {
    console.log('=== CREATE SUBSCRIPTION FROM STRIPE DEBUG ===');
    console.log('Stripe subscription ID:', stripeSubscription.id);
    console.log('Stripe customer ID:', stripeSubscription.customer);
    console.log('Stripe status:', stripeSubscription.status);
    console.log('Stripe data:', {
      current_period_start: stripeSubscription.current_period_start,
      current_period_end: stripeSubscription.current_period_end,
      trial_start: stripeSubscription.trial_start,
      trial_end: stripeSubscription.trial_end,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      canceled_at: stripeSubscription.canceled_at,
    });
    
    // Find the user by Stripe customer ID
    const user = await this.userRepository.findOne({
      where: { stripeCustomerId: stripeSubscription.customer },
    });

    if (!user) {
      console.error('User not found for Stripe customer:', stripeSubscription.customer);
      return null;
    }

    console.log('Found user:', {
      userId: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId
    });

    // Check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (existingSubscription) {
      console.log('Subscription already exists, updating...');
      return this.updateSubscriptionFromStripe(stripeSubscription);
    }

    // Create new subscription
    const subscription = this.subscriptionRepository.create({
      user,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer,
      stripePriceId: stripeSubscription.items.data[0]?.price.id,
      status: this.mapStripeStatus(stripeSubscription.status),
      plan: SubscriptionPlan.PAID,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    });

    // Add dates only if they exist
    if (stripeSubscription.current_period_start) {
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    }

    if (stripeSubscription.current_period_end) {
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    }

    if (stripeSubscription.trial_start && stripeSubscription.trial_end) {
      subscription.trialStart = new Date(stripeSubscription.trial_start * 1000);
      subscription.trialEnd = new Date(stripeSubscription.trial_end * 1000);
    }

    if (stripeSubscription.canceled_at) {
      subscription.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
    }

    console.log('Created subscription from Stripe:', {
      userId: user.id,
      subscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      plan: subscription.plan
    });

    return this.subscriptionRepository.save(subscription);
  }

  async updateSubscriptionFromStripe(stripeSubscription: any) {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
      relations: ['user'],
    });

    if (!subscription) {
      console.error('Subscription not found for Stripe subscription:', stripeSubscription.id);
      return null;
    }

    const status = this.mapStripeStatus(stripeSubscription.status);
    
    subscription.status = status;
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

    // Update dates only if they exist
    if (stripeSubscription.current_period_start) {
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    }

    if (stripeSubscription.current_period_end) {
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    }

    // Update plan to PAID for any non-canceled subscription
    if (status !== SubscriptionStatus.CANCELED) {
      subscription.plan = SubscriptionPlan.PAID;
    }

    if (stripeSubscription.canceled_at) {
      subscription.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
    }

    console.log('Updated subscription from Stripe:', {
      subscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      plan: subscription.plan
    });

    return this.subscriptionRepository.save(subscription);
  }

  async handlePaymentSucceeded(invoice: any) {
    console.log('=== PAYMENT SUCCEEDED DEBUG ===');
    console.log('Invoice ID:', invoice.id);
    console.log('Invoice subscription ID:', invoice.subscription);
    
    // Find the subscription by the invoice's subscription ID
    if (invoice.subscription) {
      const subscription = await this.subscriptionRepository.findOne({
        where: { stripeSubscriptionId: invoice.subscription },
        relations: ['user'],
      });

      if (subscription) {
        console.log('Found subscription to update:', {
          subscriptionId: subscription.stripeSubscriptionId,
          userId: subscription.user.id,
          currentStatus: subscription.status,
          currentPlan: subscription.plan
        });
        
        // Update subscription to active status
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.plan = SubscriptionPlan.PAID;
        
        console.log('Updated subscription to active after payment:', {
          subscriptionId: subscription.stripeSubscriptionId,
          userId: subscription.user.id,
          newStatus: subscription.status,
          newPlan: subscription.plan
        });

        const savedSubscription = await this.subscriptionRepository.save(subscription);
        console.log('Subscription saved successfully:', {
          id: savedSubscription.id,
          status: savedSubscription.status,
          plan: savedSubscription.plan
        });
      } else {
        console.error('Subscription not found for invoice:', invoice.id);
      }
    } else {
      console.error('No subscription ID in invoice:', invoice.id);
    }
    console.log('=== END PAYMENT SUCCEEDED DEBUG ===');
  }

  async handlePaymentFailed(invoice: any) {
    console.log('Payment failed for invoice:', invoice.id);
    // Payment failed - subscription might be past_due
    // The subscription status will be updated by the subscription.updated webhook
  }

  async handleCheckoutSessionCompleted(session: any) {
    console.log('Processing checkout session completed:', session.id);
    
    if (session.subscription) {
      // Get the subscription details from Stripe
      const stripeSubscription = await this.stripeService.getSubscription(session.subscription);
      
      if (stripeSubscription) {
        console.log('Creating subscription from checkout session:', {
          sessionId: session.id,
          subscriptionId: stripeSubscription.id,
          customerId: stripeSubscription.customer
        });
        
        await this.createSubscriptionFromStripe(stripeSubscription);
      }
    } else {
      console.error('No subscription found in checkout session:', session.id);
    }
  }

  async getActiveSubscription(userId: string) {
    return this.subscriptionRepository.findOne({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async canCreateChat(userId: string, isAdmin: boolean = false) {
    console.log('=== CAN CREATE CHAT DEBUG ===');
    console.log('User ID:', userId);
    console.log('Is Admin:', isAdmin);
    
    // Admin users have unlimited access
    if (isAdmin) {
      console.log('User is admin - allowing chat creation');
      return true;
    }

    const subscription = await this.getActiveSubscription(userId);
    console.log('Subscription found:', !!subscription);
    
    if (!subscription) {
      console.log('No subscription found - denying chat creation');
      return false;
    }

    console.log('Subscription details for chat check:', {
      plan: subscription.plan,
      status: subscription.status,
      trialEnd: subscription.trialEnd
    });

    // PAID users can create chats if subscription is ACTIVE or TRIALING
    if (subscription.plan === SubscriptionPlan.PAID) {
      console.log('User has PAID plan');
      
      if (subscription.status === SubscriptionStatus.ACTIVE) {
        console.log('Subscription is ACTIVE - allowing chat creation');
        return true;
      }
      
      if (subscription.status === SubscriptionStatus.TRIALING) {
        const now = new Date();
        const trialValid = subscription.trialEnd && isAfter(subscription.trialEnd, now);
        console.log('Subscription is TRIALING:', {
          trialEnd: subscription.trialEnd,
          now: now,
          isAfter: trialValid
        });
        return trialValid;
      }
      
      console.log('PAID subscription but not ACTIVE or valid TRIALING - denying chat creation');
    }

    // FREE users have daily limits (must have ACTIVE status)
    if (subscription.plan === SubscriptionPlan.FREE) {
      console.log('User has FREE plan');
      
      // Check if FREE subscription is active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        console.log('FREE subscription is not ACTIVE - denying chat creation');
        return false;
      }
      
      console.log('FREE subscription is ACTIVE - checking daily limits');
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const usage = await this.getTodayUsage(userId, todayStr);
      const canCreate = usage.chatsUsed < usage.maxChats;
      console.log('FREE plan usage check:', {
        date: todayStr,
        chatsUsed: usage.chatsUsed,
        maxChats: usage.maxChats,
        canCreate
      });
      return canCreate;
    }

    console.log('No valid subscription plan/status - denying chat creation');
    console.log('=== END CAN CREATE CHAT DEBUG ===');
    return false;
  }

  async getTodayUsage(userId: string, date: string) {
    // Use TypeORM repository to get usage for today
    const usage = await this.usageRepository
      .createQueryBuilder('usage')
      .select(['usage.chatsUsed', 'usage.maxChats'])
      .where('usage.user.id = :userId', { userId })
      .andWhere('DATE(usage.usageDate) = :date', { date })
      .getOne();

    if (usage) {
      return {
        chatsUsed: usage.chatsUsed || 0,
        maxChats: usage.maxChats || 1,
      };
    }

    return { chatsUsed: 0, maxChats: 1 };
  }

  async incrementChatUsage(userId: string) {
    console.log('Incrementing chat usage for user:', userId);
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      console.log('No subscription found, skipping usage increment');
      return;
    }

    console.log('User subscription plan:', subscription.plan);

    // Only track usage for FREE plan users
    if (subscription.plan === SubscriptionPlan.FREE) {
      try {
        // Check if usage record exists for today using TypeORM repository
        const existingUsage = await this.usageRepository
          .createQueryBuilder('usage')
          .where('usage.user.id = :userId', { userId })
          .andWhere('DATE(usage.usageDate) = :date', { date: todayStr })
          .getOne();

        if (existingUsage) {
          // Update existing usage using repository
          existingUsage.chatsUsed += 1;
          await this.usageRepository.save(existingUsage);
          console.log('Updated existing usage record:', existingUsage.id);
        } else {
          // Create new usage record using repository
          const newUsage = this.usageRepository.create({
            user: { id: userId },
            usageDate: new Date(todayStr),
            chatsUsed: 1,
            maxChats: 1,
          });
          await this.usageRepository.save(newUsage);
          console.log('Created new usage record for date:', todayStr);
        }
      } catch (error) {
        console.error('Error incrementing chat usage:', error);
        // Don't fail chat creation if usage tracking fails
      }
    } else {
      console.log('PAID plan - not tracking usage');
    }
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      case 'incomplete_expired':
        return SubscriptionStatus.INCOMPLETE_EXPIRED;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }
}
