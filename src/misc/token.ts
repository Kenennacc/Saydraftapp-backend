import { randomBytes } from 'crypto';
import { TokenType } from 'src/entities';

export default {
  [TokenType.URL]: () => randomBytes(64).toString('hex'),
  [TokenType.OTP]: () => '',
} satisfies Record<TokenType, () => string>;
