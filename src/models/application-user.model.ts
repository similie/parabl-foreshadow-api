import {
  EllipsiesBaseModelUUID,
  Entity,
  Index,
  Column,
  OneToMany,
} from "@similie/ellipsies";
import UserTokens from "./user-tokens.model";

@Index("user_api_key_key", ["apiKey"], { unique: true })
@Index("user_email_key", ["email"], { unique: true })
@Index("user_pkey", ["id"], { unique: true })
@Index("user_username_key", ["userName"], { unique: true })
@Entity("user", { schema: "public" })
export default class ApplicationUser extends EllipsiesBaseModelUUID {
  @Column("text", { name: "username", unique: true })
  public userName: string;

  @Column("text", { name: "email", unique: true, nullable: true })
  public email: string;

  @Column("text", { name: "phone", nullable: true })
  public phone: string | null;

  @Column("text", { name: "name", nullable: true })
  public name: string | null;

  @Column("text", { name: "api_session", nullable: true })
  public apiSession: string | null;

  @Column("text", { name: "api_key", nullable: true, unique: true })
  public apiKey: string | null;

  @Column("json", { name: "avatar", nullable: true })
  public avatar: object | null;

  // One user has many tokens
  @OneToMany(() => UserTokens, (token) => token.user, { cascade: true })
  public tokens: UserTokens[];
}
