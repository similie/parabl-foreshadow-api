import {
  EllipsiesBaseModelUUID,
  Entity,
  Column,
  BeforeInsert,
} from "@similie/ellipsies";
import { createdAtSearch, generateUniqueId } from "../utils";

@Entity("verification_token", { schema: "public" })
export default class VerificationToken extends EllipsiesBaseModelUUID {
  @Column("varchar", { name: "token" })
  public token: string;

  @Column("boolean", { name: "valid", default: true })
  public valid: boolean;

  @BeforeInsert()
  public beforeInsert() {
    this.token = generateUniqueId();
  }

  public static async createToken(): Promise<string> {
    const created = VerificationToken.create({
      valid: true,
    });
    const saved = await created.save();
    return saved.token;
  }

  public static async validToken(token: string): Promise<boolean> {
    const found = await VerificationToken.find({
      where: { token, createdAt: createdAtSearch(15), valid: true },
    });
    return !!found.length;
  }
}
