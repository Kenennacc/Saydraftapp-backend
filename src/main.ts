import {
  UnprocessableEntityException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {
  initializeTransactionalContext,
  StorageDriver,
} from 'typeorm-transactional';
import { AppModule } from './module';

async function bootstrap() {
  initializeTransactionalContext({ storageDriver: StorageDriver.AUTO });
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    },
  });
  app.set('trust proxy', 1);
  const context = await NestFactory.createApplicationContext(ConfigModule);
  const configService = context.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser(configService.get('COOKIE_SECRET')));
  app.useGlobalPipes(
    new ValidationPipe({
      stopAtFirstError: true,
      exceptionFactory(errors) {
        const firstError = errors[0];
        let message = 'Validation failed';
        if (firstError?.constraints) {
          message = Object.values(firstError.constraints)[0];
        }
        return new UnprocessableEntityException(message);
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('SayDraft API')
    .setDescription(
      'API documentation for SayDraft - AI-powered contract drafting platform',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication and user management endpoints')
    .addTag('chats', 'Chat and contract management endpoints')
    .addTag(
      'contract-review',
      'Public contract review endpoints (no auth required)',
    )
    .addCookieAuth('session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'session',
      description: 'Session cookie for authenticated requests',
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        description: 'Contract review invitation token',
      },
      'invitation-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'SayDraft API Docs',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(+(process.env.PORT ?? 3000));
}
void bootstrap();
