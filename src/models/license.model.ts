import { EllipsiesBaseModelUUID, Entity, Column } from '@similie/ellipsies';

@Entity('user_agreement', { schema: 'public' })
export default class UserAgreement extends EllipsiesBaseModelUUID {
  @Column('text', { name: 'text' })
  public text: string;

  @Column('boolean', { name: 'valid', default: true })
  public active: boolean;
}
