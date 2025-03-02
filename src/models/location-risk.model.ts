import { EllipsiesBaseModelUUID, Entity, Column } from '@similie/ellipsies';

@Entity('location_risk', { schema: 'public' })
export default class LocationRisk extends EllipsiesBaseModelUUID {
  @Column('uuid', { name: 'location' })
  public location: string;

  @Column('uuid', { name: 'risk' })
  public risk: string;

  @Column('boolean', { name: 'is_active', default: true })
  public isActive: boolean;

  @Column('timestamp', { name: 'on_date' })
  public onDate: Date;
}
