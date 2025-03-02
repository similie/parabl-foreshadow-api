import { EllipsiesBaseModelUUID, Entity, Column } from '@similie/ellipsies';

@Entity('risk_indicator', { schema: 'public' })
export default class RiskIndicator extends EllipsiesBaseModelUUID {
  @Column('varchar', { name: 'name' })
  public name: string;

  @Column('varchar', { name: 'param_key' })
  public paramKey: string;

  @Column('float8', { name: 'floor', nullable: true })
  public floor?: number;

  @Column('float8', { name: 'ceil', nullable: true })
  public ceil?: number;

  @Column('text', { name: 'description' })
  public description: string;

  @Column('varchar', { name: 'severity' })
  public severity: string;

  @Column('integer', { name: 'severity_value' })
  public severityValue: number;

  @Column('varchar', { name: 'color', length: 7 })
  public color: string;

  @Column('boolean', { name: 'is_active', default: true })
  public isActive: boolean;
}
