import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthCookiesService } from './auth-cookies.service';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * O módulo diz ao Nest quais peças criar e conectar: controller, services e guard.
 * Registrar JwtModule aqui permite pedir JwtService no construtor do AuthService.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // signOptions define como emitir o JWT; verifyOptions exige as mesmas regras ao recebê-lo.
      // issuer identifica nossa API e audience o cliente esperado, recusando tokens de outro sistema.
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
        },
      }),
    }),
    // Define o limite, mas não o aplica sozinho: @UseGuards(ThrottlerGuard), no login,
    // é quem conta as tentativas por IP e responde 429 quando o limite é ultrapassado.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookiesService, JwtAuthGuard],
  // exports permite que AppModule use este mesmo guard como proteção global.
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
