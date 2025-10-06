import * as Joi from 'joi';

export default Joi.object({
  // Database
  DB_HOST: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_PORT: Joi.number().integer().positive().required(),

  // Redis
  // REDIS_USER: Joi.string().empty().optional(),
  // REDIS_HOST: Joi.string().optional(),
  // REDIS_PORT: Joi.number().integer().positive().optional(),
  // REDIS_PASS: Joi.string().optional(),

  // App
  PORT: Joi.number().integer().positive().default(3000),

  // AWS
  AWS_BUCKET: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_SECRET_KEY: Joi.string().required(),
  AWS_ACCESS_KEY: Joi.string().required(),

  // External APIs
  OPEN_AI_API_KEY: Joi.string().required(),
  GOOGLE_RECAPTCHA_SECRET: Joi.string().required(),
  DEEPGRAM_API_KEY: Joi.string().required(),

  // Mailgun
  MAILGUN_USERNAME: Joi.string().required(),
  MAILGUN_URL: Joi.string().uri().required(),
  MAILGUN_DOMAIN: Joi.string().required(),
  MAILGUN_API_KEY: Joi.string().required(),

  // Environment
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
}).unknown(); // allow other env vars without throwing
