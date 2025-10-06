import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from './Entity';
import Message from './Message';

@Entity({ name: 'prompts' })
export default class Prompt extends BaseEntity {
  @Column({ type: 'varchar' })
  value: string;

  @ManyToOne(() => Message, (message) => message.prompts)
  message: Message;

  @Column({ name: 'selected_at', nullable: true })
  selectedAt?: Date;
}
