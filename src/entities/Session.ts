import { Column, Entity, Index, ManyToOne } from 'typeorm';
import BaseEntity from './Entity';
import User from './User';

@Entity({ name: 'sessions' })
export default class Session extends BaseEntity {
  @Column({ unique: true })
  @Index()
  value: string;

  @Column()
  userAgentHash: string;

  @Column()
  browser: string;

  @Column({ name: 'device_name' })
  deviceName: string;

  @Column({ name: 'device_type' })
  deviceType: string;

  @Column()
  os: string;

  @Column()
  timezone: string;

  @Column({ nullable: true })
  ip?: string;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt: Date;

  @ManyToOne(() => User, (user) => user.sessions)
  user: User;
}
