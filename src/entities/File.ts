import { Column, Entity, ManyToOne } from 'typeorm';
import Chat from './Chat';
import BaseEntity from './Entity';
import Message from './Message';
import User from './User';

export enum FileType {
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

@Entity('files')
export default class File extends BaseEntity {
  @Column()
  url: string;

  @Column({ type: 'varchar' })
  type: FileType;

  @ManyToOne(() => Message, (message) => message.files, { nullable: true })
  message?: Message;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Chat)
  chat: Chat;
}
