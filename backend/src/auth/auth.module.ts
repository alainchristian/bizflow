import { Module } from '@nestjs/common';
import { CommonGuardsModule } from '../common/guards/common-guards.module.js';
import { JwtConfigModule } from '../common/jwt-config.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [UsersModule, JwtConfigModule, CommonGuardsModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
