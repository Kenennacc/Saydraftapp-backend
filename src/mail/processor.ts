import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import MailService from './service';

export enum JobName {
  USER_VERIFICATION = 'user_verification',
  USER_VERIFIED = 'user_verified',
  FORGOT_PASSWORD = 'forgot_password',
  PASSWORD_CHANGED = 'password_changed',
  CONTRACT_INVITATION = 'contract_invitation',
}

export type IMailJobData = {
  to: string;
  subject: string;
  body: string;
};

@Processor('mail')
export default class MailProcessor extends WorkerHost {
  constructor(private mailService: MailService) {
    super();
  }

  async process(job: Job<IMailJobData, any, string>) {
    console.log('here');
    const { to, subject, body } = job.data;
    const response = await this.mailService.send(to, subject, body);
    if (!response.success && response.error instanceof Error)
      throw response.error;
  }

  @OnWorkerEvent('active')
  active(job: Job) {
    console.log(
      'MailProcessor: ',
      `ID: ${job.id}`,
      `Name: ${job.name}`,
      ' - is active',
    );
  }

  @OnWorkerEvent('error')
  onError(reason: Error) {
    console.log('MailProcessor: ', reason.message);
  }
}
