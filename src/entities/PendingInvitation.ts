import { Column, Entity, Index, ManyToOne } from 'typeorm';
import Chat from './Chat';
import BaseEntity from './Entity';
import User from './User';

@Entity('pending_invitations')
export default class PendingInvitation extends BaseEntity {
  @Column({ name: 'offeree_email' })
  @Index()
  offereeEmail: string;

  @ManyToOne(() => Chat)
  offerorChat: Chat;

  @Column({ name: 'contract_text', type: 'text' })
  contractText: string;

  @ManyToOne(() => User)
  offeror: User;

  @Column({ name: 'accepted_at', nullable: true })
  acceptedAt?: Date;
}
