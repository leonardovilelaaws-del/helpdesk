import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthorizationService } from './authorization.service';
import { Roles } from './decorators/roles.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';

/**
 * O controller recebe a chamada HTTP e passa os dados ao serviço, que conhece as regras do banco.
 * @Roles('ADMIN') na classe protege todos os métodos: um usuário comum não pode se promover.
 */
@ApiTags('Administration')
@ApiCookieAuth()
@Controller('admin')
@Roles('ADMIN')
export class AuthorizationController {
  // O Nest injeta o serviço para manter as regras de acesso fora das rotas HTTP.
  constructor(private readonly authorizationService: AuthorizationService) {}

  /** Chegar aqui já prova que os guards aceitaram o login e a role ADMIN. */
  @Get('dashboard')
  dashboard() {
    return { message: 'Administration access granted' };
  }

  /** GET consulta sem alterar: pede ao serviço os perfis e as ações liberadas por cada um. */
  @Get('roles')
  listRoles() {
    return this.authorizationService.listRoles();
  }

  /** @Body recebe o JSON; o DTO é validado antes de o serviço criar o perfil. */
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.authorizationService.createRole(dto);
  }

  /** Entrega as ações disponíveis para o administrador escolher ao configurar os perfis. */
  @Get('permissions')
  listPermissions() {
    return this.authorizationService.listPermissions();
  }

  /**
   * O ID vem da URL e a lista final vem do JSON; ParseUUIDPipe rejeita IDs malformados.
   * O serviço só recebe esses valores depois das validações de entrada.
   */
  @Put('roles/:id/permissions')
  setRolePermissions(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.authorizationService.setRolePermissions(
      roleId,
      dto.permissionNames,
    );
  }

  /** Usa os dois IDs da URL para ligar conta e perfil; 204 informa sucesso sem corpo de resposta. */
  @Put('users/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  assignUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.authorizationService.assignUserRole(userId, roleId);
  }

  /** DELETE retira essa associação; não exclui o usuário nem o perfil compartilhado por outras contas. */
  @Delete('users/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.authorizationService.removeUserRole(userId, roleId);
  }

  /** Recebe true/false do DTO e delega o bloqueio ao serviço, que também cuida das sessões. */
  @Patch('users/:id/status')
  setUserStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.authorizationService.setUserStatus(userId, dto.isActive);
  }

  /** Um ADMIN pode forçar outra conta a entrar novamente, sem precisar conhecer seus tokens. */
  @Post('users/:id/revoke-sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeUserSessions(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.authorizationService.revokeUserSessions(userId);
  }
}
