import nodemailer from "nodemailer";
import * as aws from "@aws-sdk/client-ses";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
export class EmailTransport {
  private static _instance: EmailTransport | null = null;
  private _transporter: nodemailer.Transporter;
  private ses: aws.SES;

  private constructor() {
    // Configure SESClient
    const sesConfig: aws.SESClientConfig = {
      apiVersion: "2010-12-01",
      region: "us-east-1",
      credentials: defaultProvider(),
      // Credentials will be resolved from the default credential provider chain
    };
    this.ses = new aws.SES(sesConfig);
    // Configure Nodemailer transporter
    this._transporter = nodemailer.createTransport({
      SES: {
        ses: this.ses,
        aws,
      },
    });
  }

  public static get transport() {
    if (!this._instance) {
      this._instance = new EmailTransport();
    }
    return this._instance._transporter;
  }
}
