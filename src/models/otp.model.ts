import {
  EllipsiesBaseModelUUID,
  Entity,
  Column,
  BeforeInsert,
} from "@similie/ellipsies";

@Entity("otp", { schema: "public" })
export default class OTP extends EllipsiesBaseModelUUID {
  @Column("varchar", { name: "token" })
  public token: string;

  @Column("varchar", { name: "otp" })
  public otp?: string;

  @Column("boolean", { name: "active", default: true })
  public active: boolean;

  @Column("varchar", { name: "identifier" })
  public identifier?: string;

  @BeforeInsert()
  public beforeInsert() {
    if (this.otp) {
      return;
    }
    this.otp = OTP.otpValue;
  }

  public static get otpValue() {
    return Math.floor(10000 + (99999 - 10000) * Math.random()).toString();
  }
}
