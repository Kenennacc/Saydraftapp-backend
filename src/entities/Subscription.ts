import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from './Entity';
import User from './User';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

export enum SubscriptionPlan {
  FREE = 'free',
  PAID = 'paid',
}

@Entity('subscriptions')
export default class Subscription extends BaseEntity {
  @Column({ type: 'varchar' })
  status: SubscriptionStatus;

  @Column({ type: 'varchar' })
  plan: SubscriptionPlan;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId?: string;

  @Column({ name: 'stripe_subscription_id', nullable: true })
  stripeSubscriptionId?: string;

  @Column({ name: 'stripe_price_id', nullable: true })
  stripePriceId?: string;

  @Column({ name: 'trial_start', nullable: true })
  trialStart?: Date;

  @Column({ name: 'trial_end', nullable: true })
  trialEnd?: Date;

  @Column({ name: 'current_period_start', nullable: true })
  currentPeriodStart?: Date;

  @Column({ name: 'current_period_end', nullable: true })
  currentPeriodEnd?: Date;

  @Column({ name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ name: 'canceled_at', nullable: true })
  canceledAt?: Date;

  @ManyToOne(() => User, (user) => user.subscriptions)
  user: User;
}
