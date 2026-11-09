import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../config/environment';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      // Nos testes, o setup já carregou e validou .env.test antes dos imports.
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
  providers: [AppService],
})
export class AppModule {}
