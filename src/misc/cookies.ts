import { CookieOptions } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  auth: {
    names: ['meta_gandalf'],
    options: {
      domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
      secure: true,
      httpOnly: true,
      partitioned: false,
      signed: true,
      sameSite: 'none',
    },
  },
} satisfies Record<string, { names: string[]; options: CookieOptions }>;
