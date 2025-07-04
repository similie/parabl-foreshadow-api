/* eslint-disable @typescript-eslint/no-explicit-any */
// import nodemailer from 'nodemailer';
import { EmailTransport } from "./transport";

import path from "path";
import ejs from "ejs";
import fs from "fs";
export type EmailTemplateContent = {
  data: Record<string, any>;
  templateName: string;
};
export type EmailContent = { html: string; text: string };

enum CommonSubject {
  otp = "Your One-Time Passcode",
}

export class EmailTemplate {
  private static templatePath = path.join(__dirname, "templates");
  public static renderTemplate(
    templateName: string,
    data: Record<string, any>,
    isHtml = true,
  ): Promise<string> {
    const extension = isHtml ? "html.ejs" : "text.ejs";
    const filePath = path.join(this.templatePath, templateName, extension);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Template ${templateName}.${extension} not found in ${this.templatePath}`,
      );
    }

    return new Promise((resolve, reject) => {
      ejs.renderFile(filePath, data, (err, str) => {
        if (err) {
          return reject(err);
        }
        resolve(str);
      });
    });
  }

  /**
   * Render the specified EJS template with provided data.
   * @param {string} templateName The name of the EJS template file (without extension)
   * @param {Record<string, any>} data The data to inject into the template
   * @returns {Promise<string>} The rendered HTML or text
   */
  public static async render(
    templateName: string,
    data: Record<string, any>,
  ): Promise<EmailContent> {
    const [html, text] = await Promise.all([
      this.renderTemplate(templateName, data),
      this.renderTemplate(templateName, data, false),
    ]);
    return { html, text };
  }
}

export class SystemEmail {
  private static readonly FROM: string =
    process.env.DEFAULT_EMAIL_ADDRESS || "info@4shadow.io";

  public static async send(to: string, template: EmailTemplateContent) {
    const subject =
      CommonSubject[template.templateName as keyof typeof CommonSubject] ||
      "Your Parabl Request";
    const content = await EmailTemplate.render(
      template.templateName,
      template.data,
    );
    return this.sendMail(to, subject, content);
  }

  public static sendMail(to: string, subject: string, content: EmailContent) {
    const mailOptions = {
      from: this.FROM,
      to: to,
      subject: subject,
      text: content.text,
      html: content.html,
    };

    const transporter = EmailTransport.transport;
    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, function (err, data) {
        if (err) {
          return reject(err);
        }
        resolve(data);
      });
    }).catch((err) => {
      console.error("Error sending email:", err);
    });
  }
}
