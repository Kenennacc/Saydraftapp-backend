import { createHash } from 'crypto';
import { UAParser } from 'ua-parser-js';

export const parseUserAgent = (userAgent: string) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    name: result.device?.model || '(Unknown)',
    type: result.device?.type || '(Unknown)',
    os: result.os?.name || 'unknown',
    browser: result.browser?.name || 'unknown',
  };
};

export const hashUserAgent = (userAgent: string) => {
  return createHash('sha256').update(userAgent).digest('hex');
};
