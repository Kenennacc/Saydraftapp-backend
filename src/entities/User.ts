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

  @Column({ name: 'banned_at', nullable: true })
  bannedAt?: Date;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
}
