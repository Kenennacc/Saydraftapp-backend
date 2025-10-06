import { Column, Entity, Index, OneToMany } from 'typeorm';
import BaseEntity from './Entity';
import Session from './Session';

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

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
}
