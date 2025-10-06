import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { hashUserAgent, parseUserAgent } from '../misc/useragent';

export type Device = {
  os: string;
  browser: string;
  name: string;
  type: string;
  hash: string;
};

const UserAgent = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const userAgent = parseUserAgent(request.headers['user-agent'] || '');
  const hash = hashUserAgent(JSON.stringify(userAgent));
  return { ...userAgent, hash } satisfies Device;
});

export default UserAgent;
