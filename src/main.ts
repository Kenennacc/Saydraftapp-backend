import {
  UnprocessableEntityException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
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
  await app.listen(+(process.env.PORT ?? 3000));
}
void bootstrap();
