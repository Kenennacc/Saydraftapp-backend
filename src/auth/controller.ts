import { InjectQueue } from '@nestjs/bullmq';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { addHours, differenceInMinutes } from 'date-fns';
import type { Request, Response } from 'express';
import { User } from 'src/decorators';
import UserAgent, { type Device } from 'src/decorators/UserAgent';
import { TokenContext, TokenType } from 'src/entities';
import { Auth } from 'src/guards';
import { IMailJobData, JobName } from 'src/mail/processor';
import MailService from 'src/mail/service';
import baseTemplate from 'src/mail/template';
import cookieOptions from 'src/misc/cookies';
import {
  emailVerifiedTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  verificationTemplate,
} from 'src/misc/mailTemplate';
import type { User as UserType } from 'src/types';
import { IsolationLevel, Transactional } from 'typeorm-transactional';
import {
  ForgotPasswordDTO,
  LoginDTO,
  RegisterDTO,
  ResetPasswordDTO,
  VerifyDTO,
} from './dto';
import AuthService from './service';

@Controller('auth')
export default class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectQueue('mail') private mailQueue: Queue,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async register(@Body() dto: RegisterDTO) {
    const userExists = await this.authService.userExistsByEmail(dto.email);
    if (userExists)
      throw new ConflictException(
        'An account with this email already exists. Try signing in instead.',
      );

    const user = await this.authService.register(dto);
    const token = await this.authService.createToken(
      user.id,
      {
        type: TokenType.URL,
        context: TokenContext.VERIFICATION,
      },
      addHours(new Date(), 24),
    );

    const url = `${this.configService.get('CLIENT_URL')}/auth/verification?token=${token}`;

    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...verificationTemplate,
      url,
    });
    await this.mailQueue.add(JobName.USER_VERIFICATION, {
      to: user.email,
      subject: verificationTemplate.subject,
      body: template,
    } satisfies IMailJobData);
  }

  @Post('verify')
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async verify(@Body() dto: VerifyDTO) {
    const token = await this.authService.getToken(dto.token, {
      type: TokenType.URL,
      context: TokenContext.VERIFICATION,
    });

    if (!token)
      throw new UnauthorizedException(
        'Invalid or expired token. For security reasons, please restart the process or request a new token',
      );

    if (token.user.verifiedAt) {
      throw new ConflictException(
        'This email address has already been verified. You can now log in to your account.',
      );
    }

    await this.authService.verifyUser(token.user.id);
    await this.authService.markTokenAsUsed(token.id);
    const url = `${this.configService.get('CLIENT_URL')}/auth/login`;
    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...emailVerifiedTemplate,
      url,
    });
    await this.mailQueue.add(JobName.USER_VERIFIED, {
      to: token.user.email,
      subject: emailVerifiedTemplate.subject,
      body: template,
    } satisfies IMailJobData);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDTO,
    @Headers('x-timezone') timezone: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @UserAgent() userAgent: Device,
  ) {
    console.log(request.ip);

    const user = await this.authService.getUserByEmail(dto.email);

    if (
      !user ||
      !(await this.authService.compareHash(dto.password, user.password))
    )
      throw new UnauthorizedException('Invalid email or password');

    const session = await this.authService.createSession(
      user.id,
      userAgent,
      timezone,
    );

    response.cookie(cookieOptions.auth.names[0], session.value, {
      ...cookieOptions.auth.options,
      maxAge: session.expiresAt.getTime(),
    });
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDTO) {
    const user = await this.authService.getUserByEmail(dto.email);
    if (!user) return;

    const latestToken = await this.authService.getLatestToken(user.id);

    let waitPeriod;

    if (
      latestToken &&
      (waitPeriod = Math.max(
        differenceInMinutes(latestToken.expiresAt, new Date()),
        1,
      )) < 5
    ) {
      throw new HttpException(
        `You must wait for ${waitPeriod} minute(s) before requesting another link.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (latestToken) await this.authService.revokeToken(latestToken.id);

    const token = await this.authService.createToken(user.id, {
      type: TokenType.URL,
      context: TokenContext.PASSWORD_RESET,
    });
    const url = `${this.configService.get('CLIENT_URL')}/auth/reset-password?token=${token}`;

    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...passwordResetTemplate,
      url,
    });
    await this.mailQueue.add(JobName.FORGOT_PASSWORD, {
      to: user.email,
      subject: passwordResetTemplate.subject,
      body: template,
    } satisfies IMailJobData);
  }

  @Post('reset-password')
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    const token = await this.authService.getToken(dto.token, {
      context: TokenContext.PASSWORD_RESET,
      type: TokenType.URL,
    });

    if (!token)
      throw new UnauthorizedException(
        'Invalid or expired token. For security reasons, please restart the process or request a new token',
      );

    await this.authService.updateUserPassword(token.user.id, dto.password);
    await this.authService.markTokenAsUsed(token.id);
    const url = `${this.configService.get('CLIENT_URL')}/auth/login`;
    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...passwordChangedTemplate,
      url,
    });
    await this.mailQueue.add(JobName.PASSWORD_CHANGED, {
      to: token.user.email,
      subject: passwordChangedTemplate.subject,
      body: template,
    } satisfies IMailJobData);

    if (dto.invalidateSession) {
      await this.authService.invalidateSession(token.user.id);
    }
  }

  @Post('request-verify')
  @UseGuards(Auth)
  async resendVerificationToken(@User() user: UserType) {
    if (user.verifiedAt) {
      throw new ConflictException(
        'This email address has already been verified. You can now log in to your account.',
      );
    }

    const latestToken = await this.authService.getLatestToken(user.id);
    let waitPeriod;
    if (
      latestToken &&
      (waitPeriod =
        Math.min(differenceInMinutes(new Date(), latestToken.createdAt), 1) <
        10)
    ) {
      throw new HttpException(
        `You must wait for ${waitPeriod} minute(s) before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (latestToken) await this.authService.revokeToken(latestToken.id);

    const token = await this.authService.createToken(
      user.id,
      {
        type: TokenType.URL,
        context: TokenContext.VERIFICATION,
      },
      addHours(new Date(), 24),
    );

    const url = `${this.configService.get('CLIENT_URL')}/auth/verification?token=${token}`;

    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...verificationTemplate,
      url,
    });
    await this.mailQueue.add(JobName.USER_VERIFICATION, {
      to: user.email,
      subject: verificationTemplate.subject,
      body: template,
    } satisfies IMailJobData);
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(Auth)
  @Post('logout')
  async logout(
    @Res({ passthrough: true }) response: Response,
    @User() user: UserType,
  ) {
    await this.authService.invalidateSession(user.id, user.session);
    response.clearCookie(
      cookieOptions.auth.names[0],
      cookieOptions.auth.options,
    );
  }

  @UseGuards(Auth)
  @Get('user')
  user(@User() user: UserType) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { session, verifiedAt, ...others } = user;
    return { isVerified: !!verifiedAt, ...others };
  }
}
