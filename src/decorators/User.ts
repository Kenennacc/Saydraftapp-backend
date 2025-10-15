import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User as UserType } from '../types';

const User = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user: UserType }>();
  return request.user;
});

export default User;
