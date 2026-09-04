import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

/**
 * `JwtModule.registerAsync(...)` as its own global module so every module
 * that needs `JwtService` (auth, to sign tokens; the guards, to verify
 * them) shares one registration rather than each configuring its own.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_ACCESS_EXPIRES_IN_SECONDS'),
        },
      }),
    }),
  ],
  exports: [JwtModule],
})
export class JwtConfigModule {}
