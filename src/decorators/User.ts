import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

const User = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user;
});

export default User;
