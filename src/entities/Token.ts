import { Column, Entity, Index, ManyToOne } from 'typeorm';
import BaseEntity from './Entity';
import User from './User';

export enum TokenContext {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password_reset',
}

export enum TokenType {
  OTP = 'otp',
  URL = 'url',
}

@Entity({ name: 'tokens' })
export default class Token extends BaseEntity {
  @Column({ unique: true })
  @Index()
  value: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'varchar' })
  context: TokenContext;

  @Column({ type: 'varchar' })
  type: TokenType;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true })
  usedAt?: Date;
}
