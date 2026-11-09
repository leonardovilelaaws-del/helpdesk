import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsModule } from './permissions/permissions.module';

/**
 * Este módulo registra as peças de autorização para o Nest conseguir criá-las e injetá-las.
 * PrismaModule fornece o banco; os controllers recebem HTTP e o serviço altera os acessos.
 */
@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService, RolesGuard, PermissionsGuard],
  // Exportar os guards permite ao AppModule aplicá-los a todas as rotas, sem repetir @UseGuards().
  exports: [AuthorizationService, RolesGuard, PermissionsGuard],
})
export class AuthorizationModule {}
