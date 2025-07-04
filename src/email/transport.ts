import nodemailer from "nodemailer";
// import * as aws from "@aws-sdk/client-ses";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

export class EmailTransport {
  private static _instance: EmailTransport | null = null;
  private _transporter: nodemailer.Transporter;

  private constructor() {
    // 1) Initialize the SESv2 client with defaultProvider (which now sees your .env)
    const sesClient = new SESv2Client({
      region: process.env.AWS_REGION, // e.g. 'us-east-1'
      credentials: defaultProvider(), // will pick up AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, etc.
    });

    // 2) Create the Nodemailer transport
    this._transporter = nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand },
    });
  }

  public static get transport() {
    if (!this._instance) {
      this._instance = new EmailTransport();
    }
    return this._instance._transporter;
  }
}
