import { MessageTemplateProperties } from 'src/mail/service';

export const verificationTemplate = {
  subject: 'SayDraft - Verify Your Email',
  title: 'Please verify your email 😀',
  description: `Click the button below to confirm your email address and finish setting up your account. This link is valid for <span class="t11" style="margin:0;Margin:0;font-weight:700;mso-line-height-rule:exactly;">24</span> hours.`,
  buttonText: 'Verify my account',
  postText: `You&#39;re receiving this email because you have an account in <span class="t24" style="margin:0;Margin:0;font-weight:700;mso-line-height-rule:exactly;">SayDraft</span>. If you are not sure why you&#39;re receiving this, please contact us by replying to this email.`,
} satisfies Omit<MessageTemplateProperties, 'url'>;

export const loginDetectionTemplate = {
  subject: '',
  body: '',
};

export const passwordResetTemplate = {
  subject: 'SayDraft - We Got Your Password Reset Request',
  title: 'Forgot your password?',
  description: `To reset your password, click the button below. The link will self-destruct after <span class="t11" style="margin:0;Margin:0;font-weight:700;mso-line-height-rule:exactly;">5</span> minutes.`,
  buttonText: 'Reset your password',
  postText: `If you do not want to change your password or didn&#39;t request a reset, you can ignore and delete this email.`,
} satisfies Omit<MessageTemplateProperties, 'url'>;

export const passwordChangedTemplate = {
  subject: 'SayDraft – Your Password Was Successfully Changed',
  title: 'Your Password Has Been Updated',
  description: `This is a confirmation that your SayDraft account password was successfully changed. If you made this change, no further action is required.`,
  buttonText: 'Go to SayDraft',
  postText: `If you did not change your password, please reset it immediately or contact our support team for help.`,
} satisfies Omit<MessageTemplateProperties, 'url'>;

export const emailVerifiedTemplate = {
  subject: 'SayDraft – Your Email Address Has Been Verified',
  title: 'Email Verification Successful',
  description: `Thank you for verifying your email address. Your SayDraft account is now fully activated and ready to use.`,
  buttonText: 'Go to SayDraft',
  postText: `If you did not create this account or believe this verification was a mistake, please contact our support team immediately.`,
} satisfies Omit<MessageTemplateProperties, 'url'>;
