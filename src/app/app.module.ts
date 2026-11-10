import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/environment';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthorizationModule } from '../authorization/authorization.module';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { PermissionsGuard } from '../authorization/guards/permissions.guard';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Nos testes, o setup já definiu a configuração antes dos imports.
      // Ignorar arquivos aqui impede completar variáveis ausentes com o .env de desenvolvimento.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      // Valida o .env ao iniciar: é melhor recusar uma configuração insegura
      // agora do que descobrir o erro depois que alguém tentar fazer login.
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AuthModule,
    AuthorizationModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // A autenticação preenche request.user antes das regras de acesso.
    // useExisting reaproveita os guards exportados pelos módulos.
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
