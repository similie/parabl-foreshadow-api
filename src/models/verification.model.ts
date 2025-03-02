import {
  EllipsiesBaseModelUUID,
  Entity,
  Column,
  BeforeInsert,
  QueryAgent,
} from '@similie/ellipsies';
import { createdAtSearch, generateUniqueId } from '../utils';

@Entity('verification_token', { schema: 'public' })
export default class VerificationToken extends EllipsiesBaseModelUUID {
  @Column('varchar', { name: 'token' })
  public token: string;

  @Column('boolean', { name: 'valid', default: true })
  public valid: boolean;

  @BeforeInsert()
  public beforeInsert() {
    this.token = generateUniqueId();
  }

  public static async createToken(): Promise<string> {
    const queryAgent = new QueryAgent<VerificationToken>(VerificationToken, {});
    const verified = (await queryAgent.create({
      valid: true,
    })) as VerificationToken;
    return verified.token;
  }

  public static async validToken(token: string): Promise<boolean> {
    const queryAgent = new QueryAgent<VerificationToken>(VerificationToken, {
      where: { token, createdAt: createdAtSearch(15), valid: true },
    });
    const found = (await queryAgent.getObjects()) as VerificationToken[];
    return !!found.length;
  }
}
