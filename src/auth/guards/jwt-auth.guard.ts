import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_COOKIE } from '../auth.constants';
import { AuthService } from '../auth.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * É a primeira barreira de uma rota protegida: identifica quem está fazendo o pedido.
 * Depois dele, os guards de roles e permissões decidem se essa pessoa pode fazer a ação.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  /**
   * true deixa o Nest seguir para a próxima etapa; lançar 401 interrompe a requisição.
   * Quando o login confere, guardamos o usuário em request.user para as etapas seguintes.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @Public deixa um recado na rota; Reflector lê esse recado aqui.
    // O método tem prioridade: @Public(false) pode proteger uma rota de uma classe pública.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = request.cookies as Record<string, unknown> | undefined;
    // Lemos só o cookie para manter um único jeito de autenticar: enviar Bearer não basta.
    const token = cookies?.[ACCESS_COOKIE];
    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException();
    }

    // authenticate confere JWT e sessão no banco. Apenas depois disso o usuário é confiável.
    request.user = await this.authService.authenticate(token);
    return true;
  }
}
