import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import BaseEntity from './Entity';
import State from './State';
import User from './User';

export enum ChatContext {
  OFFEROR = 'offeror',
  OFFEREE = 'offeree',
}

@Entity('chats')
export default class Chat extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'varchar', default: ChatContext.OFFEROR })
  context: ChatContext;

  @ManyToOne(() => User)
  user: User;

  @OneToMany(() => State, (state) => state.chat)
  states: State[];
}
