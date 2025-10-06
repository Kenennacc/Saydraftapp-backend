import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import Chat from './Chat';
import BaseEntity from './Entity';
import File from './File';
import Prompt from './Prompts';
import User from './User';

export enum MessageType {
  TEXT = 'TEXT',
  MIC = 'MIC',
}

@Entity('messages')
export default class Message extends BaseEntity {
  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar' })
  type: MessageType;

  @ManyToOne(() => Chat)
  chat: Chat;

  @ManyToOne(() => User, { nullable: true })
  user: User;

  @Column({ name: 'is_status', default: false })
  isStatus: boolean;

  @OneToMany(() => File, (file) => file.message)
  files: File[];

  @OneToMany(() => Prompt, (prompt) => prompt.message)
  prompts: Prompt[];
}
