import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  function context(roles?: string[], classRoles?: [string, ...string[]]) {
    class TestController {
      @Roles('AGENT', 'COMPRAS')
      handle(this: void) {}
    }
    if (classRoles) Roles(...classRoles)(TestController);
    const user: AuthenticatedUser | undefined = roles && {
      id: 'user-id',
      name: 'User',
      email: 'user@example.test',
      roles,
      permissions: [],
      sessionId: 'session-id',
    };
    return new ExecutionContextHost(
      [{ user }],
      TestController,
      TestController.prototype.handle,
    );
  }

  it.each([['ADMIN'], ['MEMBER'], []])(
    'rejects users without a declared role: %j',
    (...roles) => {
      expect(() => guard.canActivate(context(roles))).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each([['AGENT'], ['COMPRAS'], ['ADMIN', 'AGENT']])(
    'accepts users with a declared role: %j',
    (...roles) => {
      expect(guard.canActivate(context(roles))).toBe(true);
    },
  );

  it('requires both the controller and handler role rules', () => {
    expect(() => guard.canActivate(context(['ADMIN'], ['ADMIN']))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context(['AGENT'], ['ADMIN']))).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(context(['ADMIN', 'AGENT'], ['ADMIN']))).toBe(
      true,
    );
  });

  it('returns 401 when the user is missing', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('leaves routes without a role rule to the other guards', () => {
    class UnrestrictedController {
      handle(this: void) {}
    }
    const unrestricted = new ExecutionContextHost(
      [{}],
      UnrestrictedController,
      UnrestrictedController.prototype.handle,
    );

    expect(guard.canActivate(unrestricted)).toBe(true);
  });
});
