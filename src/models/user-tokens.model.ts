import {
  EllipsiesBaseModelUUID,
  Entity,
  Index,
  Column,
  ManyToOne,
  JoinColumn,
} from '@similie/ellipsies';
import ApplicationUser from './application-user.model';
@Index('token_key', ['token'], { unique: true })
@Entity('user_token', { schema: 'public' })
export default class UserTokens extends EllipsiesBaseModelUUID {
  @Column('text', { name: 'token', unique: true })
  public token: string;
  @Column('varchar', { name: 'socket', nullable: true })
  public socket?: string;
  @JoinColumn()
  @ManyToOne(() => ApplicationUser, (user: ApplicationUser) => user.id)
  @Column('uuid', { name: 'user', nullable: true })
  public user?: ApplicationUser;
}
