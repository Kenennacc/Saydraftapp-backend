import * as Joi from 'joi';

export default Joi.object({

  DB_HOST: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_PORT: Joi.number().integer().positive().required(),








  PORT: Joi.number().integer().positive().default(3000),


  AWS_BUCKET: Joi.string().required(),
  AWS_REGION: Joi.string().required(),
  AWS_SECRET_KEY: Joi.string().required(),
  AWS_ACCESS_KEY: Joi.string().required(),


  OPEN_AI_API_KEY: Joi.string().required(),
  GOOGLE_RECAPTCHA_SECRET: Joi.string().required(),
  DEEPGRAM_API_KEY: Joi.string().required(),


  MAILGUN_USERNAME: Joi.string().required(),
  MAILGUN_URL: Joi.string().uri().required(),
  MAILGUN_DOMAIN: Joi.string().required(),
  MAILGUN_API_KEY: Joi.string().required(),


  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
}).unknown();
