import { createParamDecorator, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * O guard já deixou o usuário em request.user. Este decorator só o entrega ao parâmetro:
 * @CurrentUser() traz o objeto; @CurrentUser('id') traz o ID. Ele não faz o login por conta própria.
 */
export const CurrentUser = createParamDecorator(
  (
    property: keyof AuthenticatedUser | undefined,
    context: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return property ? user[property] : user;
  },
);
