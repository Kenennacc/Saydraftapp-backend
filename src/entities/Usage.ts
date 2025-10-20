import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from './Entity';
import User from './User';

@Entity('usage')
export default class Usage extends BaseEntity {
  @Column({ name: 'usage_date', nullable: true })
  usageDate?: Date;

  @Column({ name: 'chats_used', default: 0 })
  chatsUsed: number;

  @Column({ name: 'max_chats', default: 1 })
  maxChats: number;

  @ManyToOne(() => User, (user) => user.usage)
  user: User;
}
