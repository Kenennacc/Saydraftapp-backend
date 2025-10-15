import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { User as UserType } from 'src/types';

@Injectable()
export default class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user: UserType }>();
    
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!request.user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
