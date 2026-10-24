import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateServerEnv } from './env';
import { serverEnvironmentFiles } from './environment-files';

// Import this module before making any conditional runtime-module decisions.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: serverEnvironmentFiles(),
      validate: validateServerEnv,
    }),
  ],
  exports: [ConfigModule],
})
export class ApplicationConfigModule {}
