import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import { Liquid } from 'liquidjs';
import Mailgun from 'mailgun.js';
import { IMailgunClient } from 'node_modules/mailgun.js/Types/Interfaces';

export type MessageTemplateProperties = {
  subject: string;
  title: string;
  description: string;
  buttonText: string;
  url: string;
  postText: string;
};

@Injectable()
export default class MailService {
  private engine = new Liquid();
  private client: IMailgunClient;

  constructor(private configService: ConfigService) {
    this.client = new Mailgun(FormData).client({
      key: configService.get('MAILGUN_API_KEY') as string,
      url: configService.get('MAILGUN_URL'),
      username: configService.get('MAILGUN_USERNAME') as string,
    });
  }

  buildTemplate(template: string, context: MessageTemplateProperties) {
    return this.engine.parseAndRender(template, context) as Promise<string>;
  }

  async send(to: string, subject: string, template: string) {
    try {
      const response = await this.client.messages.create(
        this.configService.get('MAILGUN_DOMAIN') as string,
        {
          from: this.configService.get('MAILGUN_USERNAME'),
          to,
          subject,
          html: template,
        },
      );
      console.log(response);
      return {
        success: true,
        error: undefined,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err : new Error(err as string),
      };
    }
  }
}
