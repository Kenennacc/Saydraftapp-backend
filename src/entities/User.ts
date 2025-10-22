import { Column, Entity, Index, OneToMany } from 'typeorm';
import BaseEntity from './Entity';
import Session from './Session';
import Subscription from './Subscription';
import Usage from './Usage';

@Entity({ name: 'users' })
export default class User extends BaseEntity {
  @Column()
  firstname: string;

  @Column()
  lastname: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ name: 'verified_at', nullable: true })
  verifiedAt?: Date;

  @Column({ name: 'banned_at', nullable: true })
  bannedAt?: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({ name: 'stripe_customer_id', nullable: true })
  stripeCustomerId?: string;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @OneToMany(() => Usage, (usage) => usage.user)
  usage: Usage[];
}
