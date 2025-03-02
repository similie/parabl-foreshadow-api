import { EllipsiesBaseModelUUID, Entity, Column } from '@similie/ellipsies';

@Entity('token_locations', { schema: 'public' })
export default class TokenLocation extends EllipsiesBaseModelUUID {
  @Column('varchar', { name: 'name' })
  public name: string;

  @Column('varchar', { name: 'user' })
  public user: string;

  @Column('float', { name: 'latitude' })
  public latitude: number;

  @Column('float', { name: 'longitude' })
  public longitude: number;
}
