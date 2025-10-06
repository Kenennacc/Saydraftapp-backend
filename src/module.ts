import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import envSchema from 'src/misc/env';
import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  getDataSourceByName,
} from 'typeorm-transactional';
import { AuthModule } from './auth/module';
import { ChatsModule } from './chats/module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        return {
          host: configService.get('DB_HOST'),
          type: 'postgres',
          autoLoadEntities: true,
          port: configService.get('DB_PORT'),
          username: configService.get('DB_USER'),
          password: configService.get('DB_PASS'),
          synchronize: configService.get('NODE_ENV') !== 'production',
          database: configService.get('DB_NAME'),
          invalidWhereValuesBehavior: {
            null: 'throw',
            undefined: 'throw',
          },
        };
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }

        return (
          getDataSourceByName('default') ??
          addTransactionalDataSource(new DataSource(options))
        );
      },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        return {
          connection: {
            host: configService.get('REDIS_HOST'),
            port: +(configService.get('REDIS_PORT') ?? 6379),
            username: configService.get('REDIS_USER'),
            password: configService.get('REDIS_PASS'),
          },
        };
      },
    }),
    AuthModule,
    ChatsModule,
  ],
  exports: [],
})
export class AppModule {}
