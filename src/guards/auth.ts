import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAfter } from 'date-fns';
import { Request } from 'express';
import AuthService from 'src/auth/service';
import RequiresVerification from 'src/decorators/RequiresVerification';

@Injectable()
export default class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieValue = request.signedCookies?.meta_gandalf as
      | string
      | undefined;

    if (!cookieValue) throw new UnauthorizedException('No session provided');



    const session = await this.authService.getSession(cookieValue);

    if (!session) throw new UnauthorizedException('Invalid session');

    if (session.expiresAt && isAfter(new Date(), session.expiresAt))
      throw new UnauthorizedException('Session Expired');

    const requiresVerification = this.reflector.get(
      RequiresVerification,
      context.getHandler(),
    );

    if (requiresVerification) {
      throw new UnauthorizedException(
        'Email verification required. Please verify your email address to proceed.',
      );
    }
    const { user, value } = session;

    request.user = {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      timezone: session.timezone,
      verifiedAt: user.verifiedAt,
      session: value,
    };

    return true;
  }
}
