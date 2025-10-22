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
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { addHours, differenceInMinutes } from 'date-fns';
import type { Request, Response } from 'express';
import {
  ContractJobName,
  IProcessPendingInvitations,
} from 'src/chats/processor';
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
import { SubscriptionService } from 'src/services/Subscription';
import type { User as UserType } from 'src/types';
import { IsolationLevel, Transactional } from 'typeorm-transactional';
import {
  ChangePasswordDTO,
  ForgotPasswordDTO,
  LoginDTO,
  RegisterDTO,
  ResetPasswordDTO,
  UpdateProfileDTO,
  VerifyDTO,
} from './dto';
import AuthService from './service';

@Controller('auth')
export default class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectQueue('mail') private mailQueue: Queue,
    @InjectQueue('contract') private contractQueue: Queue,
    private mailService: MailService,
    private configService: ConfigService,
    private subscriptionService: SubscriptionService,
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

    // Create free subscription for new user
    try {
      await this.subscriptionService.createFreeSubscription(user.id);
      console.log('✅ Free subscription created for user:', user.email);
    } catch (error) {
      console.error('❌ Error creating free subscription:', error);
      // Don't fail registration if subscription creation fails
    }

    await this.contractQueue.add(ContractJobName.PROCESS_PENDING_INVITATIONS, {
      email: dto.email,
    } as IProcessPendingInvitations);

    const token = await this.authService.createToken(
      user.id,
      {
        type: TokenType.URL,
        context: TokenContext.VERIFICATION,
      },
      addHours(new Date(), 24),
    );

    console.log('Token', token);

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
  @ApiOperation({ summary: 'Verify user email with token' })
  @ApiBody({ type: VerifyDTO })
  @ApiResponse({ status: 200, description: 'Email successfully verified' })
  @ApiResponse({ status: 404, description: 'Invalid or expired token' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
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

    if (token.user?.verifiedAt) {
      throw new ConflictException(
        'This email address has already been verified. You can now log in to your account.',
      );
    }

    if (token.user) {
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
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDTO })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in. Session cookie set.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
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

    // Update last login timestamp
    await this.authService.updateLastLogin(user.id);

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

    let waitPeriod: number;

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

    if (!token || !token.user)
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
    const { session, verifiedAt, isAdmin, ...others } = user;
    return { isVerified: !!verifiedAt, isAdmin, ...others };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({ type: ChangePasswordDTO })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Current password is incorrect',
  })
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async changePassword(@User() user: UserType, @Body() dto: ChangePasswordDTO) {
    const userRecord = await this.authService.getUserById(user.id);
    if (!userRecord) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await this.authService.compareHash(
      dto.currentPassword,
      userRecord.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new ConflictException(
        'New password must be different from current password',
      );
    }

    await this.authService.updateUserPassword(user.id, dto.newPassword);

    // Send email notification
    const url = `${this.configService.get('CLIENT_URL')}/auth/login`;
    const template = await this.mailService.buildTemplate(baseTemplate, {
      ...passwordChangedTemplate,
      url,
    });
    await this.mailQueue.add(JobName.PASSWORD_CHANGED, {
      to: user.email,
      subject: passwordChangedTemplate.subject,
      body: template,
    } satisfies IMailJobData);

    return { message: 'Password changed successfully' };
  }

  @Post('update-profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(Auth)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDTO })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
  })
  @Transactional({ isolationLevel: IsolationLevel.SERIALIZABLE })
  async updateProfile(@User() user: UserType, @Body() dto: UpdateProfileDTO) {
    if (!dto.firstname && !dto.lastname) {
      throw new ConflictException('At least one field must be provided');
    }

    await this.authService.updateUserProfile(user.id, {
      ...(dto.firstname && { firstname: dto.firstname }),
      ...(dto.lastname && { lastname: dto.lastname }),
    });

    // Get updated user data
    const updatedUser = await this.authService.getUserById(user.id);

    return {
      message: 'Profile updated successfully',
      user: {
        firstname: updatedUser!.firstname,
        lastname: updatedUser!.lastname,
        email: updatedUser!.email,
      },
    };
  }
}
