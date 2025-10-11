import { Column, Entity, ManyToOne } from 'typeorm';
import Chat from './Chat';
import BaseEntity from './Entity';

export enum ChatState {
  MIC = 'MIC',
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  NONE = 'NONE',
}

@Entity({ name: 'states' })
export default class State extends BaseEntity {
  @Column({ type: 'varchar', default: ChatState.MIC })
  value: ChatState;

  @ManyToOne(() => Chat, (chat) => chat.states)
  chat: Chat;
}
